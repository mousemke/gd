
// gangster disciples
// 1.0.0
//
// @author Mouse Braun <mouse@styla.com>

const http          = require( 'http' );
const fs            = require( 'fs' );
const url           = require( 'url' );
const JsZip         = require( 'jszip' );
const google        = require( 'googleapis' );
const rimraf        = require( 'rimraf' );
const config        = require( './config.js' );

const key           = config.serviceAcct;
const auth          = google.auth;
const drive         = google.drive( 'v3' );

const CLEAN_UP          = config.cleanDirectory;
const BACKUP_INTERVAL   = config.backupInterval;
const ROOT_DIR          = config.rootDir;
const BASE_DIR          = config.baseDir;
const IGNORED_FILES     = config.ignoreList;


/**
 * ## GD
 *
 * Google drive backup server
 */
class GD
{
    /**
     * ## buildZipStructure
     *
     * organizes files and folders in the right structure for the zip file
     *
     * @param {Object} zipContext current zip folder
     * @param {Object} fileTree file organizational object
     * @param {String} baseDir curret working directory
     */
    buildZipStructure( zipContext, fileTree, baseDir )
    {
        return new Promise( ( resolve, reject  ) =>
        {
            const keys = Object.keys( fileTree );

            keys.forEach( file =>
            {
                if ( fileTree[ file ] === true )
                {
                    const data = fs.readFileSync( `${baseDir}/${file}` );

                    console.log( `read ${file} ` );
                    zipContext.file( file, data );
                }
                else
                {
                    console.log( `entering directory ${file} ` );
                    const directory = zipContext.folder( file );

                    this.buildZipStructure( directory, fileTree[ file ],
                                                        `${baseDir}/${file}` );
                }
            } );

            resolve( zipContext );
        } );
    }


    /**
     * ## constructor
     *
     * starts the server and listeners, as well as setting the backup interval
     */
    constructor()
    {
        this.config     = config;
        this.url        = url;
        this.lastBackup = null;

        this.auth       = new auth.JWT( key.client_email,
                                        null,
                                        key.private_key,
                                        config.scopes,
                                        null );

        this.http       = http;
        this.server     = this.http.createServer(
                                            this.serverFunction.bind( this ) );

        this.server.listen( config.serverPort );

        console.log( `HTTP Server is started on port ${config.serverPort}` );

        this.startBackup();

        this.backupInterval = setInterval( this.startBackup, BACKUP_INTERVAL );
    }


    /**
     * ## fetchFiles
     *
     * does the actualy api call to get the google drive file list
     */
    fetchFiles()
    {
        return new Promise( ( resolve, reject ) =>
        {
            drive.files.list( {
                fields      : 'files(id, name, mimeType, parents, sharingUser)',
                auth        : this.auth
            },
            ( err, res ) =>
            {
                if ( err )
                {
                    reject( err );
                }
                else
                {
                    resolve( res );
                }
            } );
        } );
    }


    /**
     * ## getDirectoryFiles
     *
     * reads the file structure to see if something is a file or directory,
     * then builds accordingly
     *
     * @param {String} fileDir file path
     * @param {String} fullDir full path
     * @param {Object} filesList recirsive file container.  starts empty
     *
     * @return {Object} filesList
     */
    getDirectoryFiles( fileDir, fullDir, filesList = {} )
    {
        const files = fs.readdirSync( fullDir );
        const cwd   = filesList[ fileDir ] = {};

        files.forEach( file =>
        {
            if ( IGNORED_FILES.indexOf( file ) === -1 )
            {
                const dir = fs.lstatSync( `${fullDir}/${file}` ).isDirectory();

                if ( dir )
                {
                    this.getDirectoryFiles( file, `${fullDir}/${file}/`,
                                                        filesList[ fileDir ] );
                }
                else
                {
                    filesList[ fileDir ][ file ] = true;
                }
            }
        } );

        return filesList;
    }


    /**
     * ## mkdir
     *
     * makes directories recursively
     *
     * @param {String} path file path
     * @param {String} base file path base
     *
     * @return {Boolean} finished or not
     */
    mkdir( path, base )
    {
        const folders     = path.split( '/' );
        const folder    = folders.shift();

        base = `${base}/${folder}`;

        console.log( 'trying:', base );
        if ( !fs.existsSync( base ) )
        {
            fs.mkdirSync( base );
        }

        return !folders.length || this.mkdir( folders.join( '/' ), base );
    }


    /**
     * ## sendResponse
     *
     * completes the http response
     *
     * @param {Object} data response data to output
     * @param {Object} cookies cookies to add to the header (opt)
     */
    sendResponse( data, cookies )
    {
        if ( typeof data !== 'string' )
        {
            data            = JSON.stringify( data );
        }

        const response    = this.response;
        const request     = this.request;
        const headers     = [
            [ 'access-control-allow-origin', request.headers.origin || '*' ],
            [ 'Content-Type', 'application/json' ],
            [ 'content-length', data.length ]
        ];

        if ( cookies )
        {
            for ( const prop in cookies )
            {
                headers.push( [ 'Set-Cookie',
                                    `${prop}=${cookies[ prop ]};Path=/;` ] );
            }
        }

        response.writeHead(
            '200',
            'OK',
            headers
        );

        response.write( data );
        response.end();
    }


    /**
     * ## serverFunction
     *
     * actual server.  mostly just resets the timeout
     *
     * @param {Object} request
     * @param {Object} response
     *
     * @return {Void}
     */
    serverFunction( request, response )
    {
        this.request    = request;
        this.response   = response;

        this.auth.authorize( ( err, tokens ) =>
        {
            if ( err )
            {
                this.sendResponse( {
                    err : 'error retrieving auth.authorize'
                } );

                console.log( 'auth err: ', err );

                return;
            }

            if ( request.method === 'GET' )
            {
                this.sendResponse( {
                    status      : 'still here!',
                    currentTime : Date.now(),
                    lastBackup  : this.lastBackup
                } );
            }
        } );
    }


    /**
     * ## sortFolders
     *
     * from the google drive files list, this sorts out only the folders
     *
     * @param {Array} files list of files from GD
     *
     * @return {Object} collected folders
     */
    sortFolders( files )
    {
        const folders = {};

        files.forEach( folder =>
        {
            if ( folder.mimeType === 'application/vnd.google-apps.folder' )
            {
                folders[ folder.id ] = folder;
            }
        } );

        return folders;
    }


    /**
     * ## startBackup
     *
     * starts the thing.  called at the end of the constructor and on interval
     */
    startBackup()
    {
        this.nextBackup = Date.now() + BACKUP_INTERVAL;

        console.log( 'Starting backup.' );

        const files     = this.fetchFiles();
        this.writeFile( files );
    }


    /**
     * ## timestampToDatestamp
     *
     * formats a supplied timestamp into a human readable date
     *
     * @param {Number} stamp timestamp of Date.now()
     *
     * @return {String} day-month-year-hourminute
     */
    timestampToDatestamp( stamp = Date.now() )
    {
        const dateObj   = new Date( stamp );

        const month     = dateObj.getUTCMonth() + 1;
        const day       = dateObj.getUTCDate();
        const year      = dateObj.getUTCFullYear();
        const minutes   = dateObj.getUTCMinutes();
        const hours     = dateObj.getUTCHours();

        return `${day}-${month}-${year}-${hours}${minutes}`;
    }




    writeFile( files )
    {
        files.then( f =>
        {
            let { files }   = f;

            const folders = this.sortFolders( files );

            files = files.filter( file => !folders[ file.id ] );


            files.forEach( file =>
            {

                const parents = file.parents;

                if ( parents && parents.length === 1 )
                {
                    function getPath( folderId, path = '' )
                    {
                        const folder = folders[ folderId ];

                        if ( !folder )
                        {
                            return path;
                        }

                        if ( folder && folder.parents )
                        {
                            path = getPath( folder.parents[ 0 ], '' );
                        }

                        return `${path}/${folder.name}`;
                    }

                    file.path = getPath( parents[ 0 ] );

                }
                else if ( parents && parents.length > 1 )
                {
                    throw 'untested scenario';
                }
                else
                {
                    file.path = '/';
                }

                this.mkdir( file.path.slice( 1 ), `${ROOT_DIR}/${BASE_DIR}` );
            } );


            Promise.all( files.map( file =>
            {
                return new Promise( ( resolve, reject ) =>
                {
                    const dest = fs.createWriteStream( `${ROOT_DIR}/${BASE_DIR}${file.path}/${file.name}` ); // eslint-disable-line

                    drive.files.get( {
                        auth    : this.auth,
                        fileId  : file.id,
                        alt    : 'media'
                    } )
                    .on( 'end', () => {
                        console.log( `Done retrieving ${file.name}` );
                        resolve( 'Done' );
                    } )
                    .on( 'error', ( err ) => {
                        console.log( 'Error during download', err );
                        reject( 'error' );
                    } )
                    .pipe( dest );
                } );
            } ) ).then( () => this.zipFile() );
        } );
    }


    /**
     * ## zipFile
     *
     * after file data is collected, this writes the zip file and deletes the
     * origin directory
     */
    zipFile()
    {
        const fileTree  = this.getDirectoryFiles( BASE_DIR,
                                                    `${ROOT_DIR}/${BASE_DIR}` );
        const zip       = new JsZip();

        this.buildZipStructure( zip, fileTree, ROOT_DIR ).then( () =>
        {
            const now       = this.lastBackup = Date.now();
            const nowDate   = this.timestampToDatestamp( now );
            const next      = this.timestampToDatestamp( this.nextBackup );

            zip.generateNodeStream( {
                streamFiles : true
            } )
            .pipe( fs.createWriteStream( `./backup-${nowDate}.zip` ) )
            .on( 'finish', () =>
            {
                if ( CLEAN_UP )
                {
                    rimraf( `${ROOT_DIR}/${BASE_DIR}`, () => {} );
                }

                console.log( `./backup-${nowDate}.zip written.  Next backup at ${next}` ); // eslint-disable-line
            } );
        } );
    }
}


module.exports = new GD();
