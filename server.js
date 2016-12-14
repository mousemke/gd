
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
const packageJSON   = require( './package.json' );

const key           = config.serviceAcct;
const auth          = google.auth;
const drive         = google.drive( 'v3' );
const filter        = f => f;

const CLEAN_UP      = false;
const ROOT_DIR      = '.';
const BASE_DIR      = 'backup';

const IGNORED_FILES = [
    '.DS_Store'
];


/**
 * ## GD
 *
 * Google drive backup server
 */
class GD
{
    /**
     * ## constructor
     *
     * starts the server and listeners
     */
    constructor()
    {
        this.package    = packageJSON;

        let version     = this.version = this.package.version;
        this.config     = config;
        this.url        = url;
        this.lastBackup = null;

        this.auth       = new auth.JWT( key.client_email, null, key.private_key, config.scopes, null );

        this.http       = http;
        this.server     = this.http.createServer( this.serverFunction.bind( this ) );

        this.server.listen( config.serverPort );

        console.log( `HTTP Server is started on port ${config.serverPort} (${version})` );

        const files     = this.fetchFiles();

        this.writeFile( files );
    }


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
                // console.log( 'res', res )
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


    getDirectoryFiles( fileDir, fullDir, filesList = {} )
    {
        const files = fs.readdirSync( fullDir );
        const cwd   = filesList[ fileDir ] = {};

        files.forEach( file =>
        {
            if ( IGNORED_FILES.indexOf( file ) === -1 )
            {
                const isDir = fs.lstatSync( `${fullDir}/${file}` ).isDirectory();

                if ( isDir )
                {
                    this.getDirectoryFiles( file, `${fullDir}/${file}/`, filesList[ fileDir ] );
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

        let response    = this.response;
        let request     = this.request;
        let headers     = [
            [ 'access-control-allow-origin', request.headers.origin || '*' ],
            [ 'Content-Type', 'application/json' ],
            [ 'content-length', data.length ]
        ];

        if ( cookies )
        {
            for ( let prop in cookies )
            {
                headers.push( [ 'Set-Cookie', `${prop}=${cookies[ prop ]};Path=/;` ] );
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
                this.sendResponse( { err : 'error retrieving auth.authorize' } );
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


    writeFile( files )
    {
        files.then( f =>
        {
            let { files }   = f;
            const folders   = {};

            files.forEach( folder =>
            {
                if ( folder.mimeType === 'application/vnd.google-apps.folder' )
                {
                    folders[ folder.id ] = folder;
                }
            } );

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

                function mkdir( path, base )
                {
                    let folders     = path.split( '/' );
                    const folder    = folders.shift();

                    base = `${base}/${folder}`;

                    console.log( 'trying:', base )
                    if ( !fs.existsSync( base ) )
                    {
                        fs.mkdirSync( base );
                    }

                    return !folders.length || mkdir( folders.join( '/' ), base );
                }

                mkdir( file.path.slice( 1 ), `${ROOT_DIR}/${BASE_DIR}` );
            } );


            Promise.all( files.map( file =>
            {
                return new Promise( ( resolve, reject ) =>
                {
                    const dest = fs.createWriteStream( `${ROOT_DIR}/${BASE_DIR}${file.path}/${file.name}` );

                    drive.files.get( {
                        auth    : this.auth,
                        fileId  : file.id,
                        alt    : 'media'
                    } )
                    .on( 'end', function()
                    {
                        console.log( `Done retrieving ${file.name}` );
                        resolve( 'Done' );
                    } )
                    .on( 'error', function( err )
                    {
                      console.log( 'Error during download', err );
                      reject( 'error' );
                    } )
                    .pipe( dest );
                } );
            } ) ).then( () => this.zipFile() );
        } );
    }


    zipFile()
    {
        function checkFile( zipContext, fileTree, baseDir )
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

                        checkFile( directory, fileTree[ file ], `${baseDir}/${file}` );
                    }
                } );

                resolve( zipContext );
            } );
        }


        const fileTree  = this.getDirectoryFiles( BASE_DIR, `${ROOT_DIR}/${BASE_DIR}` );
        const zip       = new JsZip();

        checkFile( zip, fileTree, ROOT_DIR ).then( () =>
        {
            // console.log( zip )
            zip.generateNodeStream( {
                streamFiles : true
            } )
            .pipe( fs.createWriteStream( './backup.zip' ) )
            .on( 'finish', () =>
            {
                rimraf( `${ROOT_DIR}/${BASE_DIR}`, () => {} );

                this.lastBackup = Date.now();
                console.log( './backup.zip written.' );
            } );
        } );
    }
};


module.exports = new GD();
