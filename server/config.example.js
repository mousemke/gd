module.exports = {

    scopes          : [ 'https://www.googleapis.com/auth/drive' ],

    serverPort      : '16666',

    serviceAcct     : {
        'type'                        : 'service_account',
        'project_id'                  : '666',
        'private_key_id'              : '1234567890abcdefghijklmnopqrstuvwxyz',
        'private_key'                 : '-----BEGIN PRIVATE KEY-----\n1234567890abcdefghijklmnopqrstuvwxyz\n-----END PRIVATE KEY-----\n',
        'client_email'                : 'example@appspot.gserviceaccount.com',
        'client_id'                   : '1234567890abcdefghijklmnopqrstuvwxyz',
        'auth_uri'                    : 'https://accounts.google.com/o/oauth2/auth',
        'token_uri'                   : 'https://accounts.google.com/o/oauth2/token',
        'auth_provider_x509_cert_url' : 'https://www.googleapis.com/oauth2/v1/certs',
        'client_x509_cert_url'        : 'https://www.googleapis.com/robot/v1/metadata/x509/example%40appspot.gserviceaccount.com'
    },


    backupInterval  : 86400000, // 24 hours

    baseDir         : 'backup',

    cleanDirectory  : true,

    ignoreList      : [
        '.DS_Store'
    ],

    rootDir         : '.'
};
