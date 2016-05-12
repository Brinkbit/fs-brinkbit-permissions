'use strict';

const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const logger = require( 'brinkbit-logger' )({ __filename, transport: 'production' });
const mongoConfig = require( 'the-brink-mongodb' );
const Permissions = require( './schemas/permissionSchema.js' );
mongoose.Promise = Promise;

const connect = () => {
    return new Promise(( resolve, reject ) => {
        if ( conn.readyState === 1 ) {
            logger.warning( 'Already connected. Resolving.' );
            return resolve();
        }

        const mongodbURI = mongoConfig.mongodb.uri;
        logger.info( `Attempting to connect to: ${mongodbURI}` );
        mongoose.connect( mongodbURI );
        conn.on( 'error', ( err ) => reject( err ));
        conn.on( 'connected', resolve );
    });
};


const verify = ( guid, userId, operation ) => {
    logger.info( `Checking ${operation} permission on ${guid} for ${userId}` );
    return Permissions.findOne({ $and: [{ userId }, { resourceId: guid }] }).exec()
    .then( permissions => {
        // Check for returned permissions, and that it matches the operation
        if ( !permissions || ( operation === 'read' && !permissions.read ) || (( operation === 'write' || operation === 'update' ) && !permissions.write ) || ( operation === 'destroy' && !permissions.destroy )) {
            logger.info( 'User does not have permission, rejecting.' );
            return Promise.reject( 'NOT_ALLOWED' );
        }

        logger.info( 'User has permission, resolving.' );
    })
    .catch( err => Promise.reject( err ));
};

module.exports = function fsBrinkbitPermissions() {
    return {
        verify,
        connect,
    };
};
