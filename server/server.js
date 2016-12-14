
/* globals require, module, console, setInterval, Promise */

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


const NOOP  = () =>
{
};


/**
 * ## GD
 *
 * Google drive backup server
 */
class GD
{
    /**
     * ## buildPaths
     *
     * builds the path strings for each file
     *
     * @param {Array} files file list
     * @param {Object} folders forders extracted from files
     */
    buildPaths( files, folders )
    {
        files.forEach( file =>
        {

            const parents = file.parents;

            if ( parents && parents.length === 1 )
            {
                file.path = this.getPath( folders, parents[ 0 ] );

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
    }


    /**
     * ## buildZipStructure
     *
     * organizes files and folders in the right structure for the zip file
     *
     * @param {Object} zipContext current zip folder
     * @param {Object} fileTree file organizational object
     * @param {String} baseDir curret working directory
     *
     * @return {Promise} success status
     */
    buildZipStructure( zipContext, fileTree, baseDir )
    {
        return new Promise( resolve =>
        {
            const keys = Object.keys( fileTree );

            keys.forEach( file =>
            {
                if ( fileTree[ file ] === true )
                {
                    const data = fs.readFileSync( `${baseDir}/${file}` );

                    console.warn( `read ${file} ` );
                    zipContext.file( file, data );
                }
                else
                {
                    console.warn( `entering directory ${file} ` );
                    const directory = zipContext.folder( file );

                    this.buildZipStructure( directory, fileTree[ file ],
                                                        `${baseDir}/${file}` );
                }
            } );

            resolve( true );
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

        console.warn( `HTTP Server is started on port ${config.serverPort}` );

        this.startBackup();

        this.backupInterval = setInterval( this.startBackup, BACKUP_INTERVAL );
    }


    /**
     * ## fetchFiles
     *
     * does the actualy api call to get the google drive file list
     *
     * @return {Promise} file list
     */
    fetchFiles()
    {
        return new Promise( ( resolve, reject ) =>
        {
            drive.files.list( {
                fields      : 'files(id, name, mimeType, parents, sharingUser)',
                auth        : this.auth,
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
                    this.getDirectoryFiles( file, `${fullDir}/${file}/`, cwd );
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
     * ## getPath
     *
     * recursively gets the full path of a file
     *
     * @param {Object} folders folders organized by id
     * @param {String} folderId id reference to the folders object
     * @param {String} pathRaw recursively built path
     *
     * @return {String} path
     */
    getPath( folders, folderId, pathRaw = '' )
    {
        let path        = pathRaw;
        const folder    = folders[ folderId ];

        if ( !folder )
        {
            return pathRaw;
        }

        if ( folder && folder.parents )
        {
            path = this.getPath( folders, folder.parents[ 0 ], '' );
        }

        return `${path}/${folder.name}`;
    }


    /**
     * ## mkdir
     *
     * makes directories recursively
     *
     * @param {String} path file path
     * @param {String} baseRaw file path base
     *
     * @return {Boolean} finished or not
     */
    mkdir( path, baseRaw )
    {
        const folders   = path.split( '/' );
        const folder    = folders.shift();
        const base      = `${baseRaw}/${folder}`;

        if ( !fs.existsSync( base ) )
        {
            console.warn( 'Making directory:', base );
            fs.mkdirSync( base );
        }

        return !folders.length || this.mkdir( folders.join( '/' ), base );
    }


    /**
     * ## sendResponse
     *
     * completes the http response
     *
     * @param {Object} dataRaw response data to output
     * @param {Object} cookies cookies to add to the header (opt)
     */
    sendResponse( dataRaw, cookies )
    {
        let data = dataRaw;

        if ( typeof data !== 'string' )
        {
            data            = JSON.stringify( data );
        }

        const response    = this.response;
        const request     = this.request;
        const headers     = [
            [ 'access-control-allow-origin', request.headers.origin || '*' ],
            [ 'Content-Type', 'application/json' ],
            [ 'content-length', data.length ],
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
     */
    serverFunction( request, response )
    {
        this.request    = request;
        this.response   = response;

        this.auth.authorize( err =>
        {
            if ( err )
            {
                this.sendResponse( {
                    err : 'error retrieving auth.authorize',
                } );

                console.error( 'auth err: ', err );

                return;
            }

            if ( request.method === 'GET' )
            {
                this.sendResponse( {
                    status      : 'still here!',
                    currentTime : Date.now(),
                    lastBackup  : this.lastBackup,
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

        console.warn( 'Starting backup.' );

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


    /**
     * ## writeFiles
     *
     * writes the google drive files to the drive in their original
     * directory structure
     *
     * @param {Array} files file list from google drive
     */
    writeFile( files )
    {
        files.then( f =>
        {
            let { files }   = f;

            const folders = this.sortFolders( files );

            files = files.filter( file => !folders[ file.id ] );
            this.buildPaths( files, folders );


            Promise.all( files.map( file =>
            {
                return new Promise( ( resolve, reject ) =>
                {
                    const dest = fs.createWriteStream( `${ROOT_DIR}/${BASE_DIR}${file.path}/${file.name}` ); // eslint-disable-line

                    drive.files.get( {
                        auth    : this.auth,
                        fileId  : file.id,
                        alt    : 'media',
                    } )
                    .on( 'end', () =>
                    {
                        console.warn( `Done retrieving ${file.name}` );
                        resolve( 'Done' );
                    } )
                    .on( 'error', ( err ) =>
                    {
                        console.error( 'Error during download', err );
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
                streamFiles : true,
            } )
            .pipe( fs.createWriteStream( `./backup-${nowDate}.zip` ) )
            .on( 'finish', () =>
            {
                if ( CLEAN_UP )
                {
                    rimraf( `${ROOT_DIR}/${BASE_DIR}`, NOOP );
                    console.warn( `Temporary directory ${ROOT_DIR}/${BASE_DIR} removed` );
                }

                console.warn( `./backup-${nowDate}.zip written.  Next backup at ${next}` ); // eslint-disable-line
            } );
        } );
    }
}


module.exports = new GD();
