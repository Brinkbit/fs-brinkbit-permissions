'use strict';

const logger = require( 'brinkbit-logger' )({ __filename, transport: 'production' });
const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const Permissions = require( '../src/schemas/permissionSchema.js' )( conn );
const db = require( 'brinkbit-mongodb' )( conn );

const verify = ( guid, userId, operation ) => {
    logger.info( `Checking ${operation} permission on ${guid} for ${userId}` );
    return Permissions.findOne({ $and: [{ userId }, { resourceId: guid }] }).exec()
    .then( permissions => {
        if ( !permissions || ( operation === 'read' && !permissions.read ) || (( operation === 'write' || operation === 'update' ) && !permissions.write ) || ( operation === 'destroy' && !permissions.destroy )) {
            logger.info( 'User does not have permission, rejecting.' );
            return Promise.reject( 'NOT_ALLOWED' );
        }

        logger.info( 'User has permission, resolving.' );
    })
    .catch( err => Promise.reject( err ));
};

module.exports = function fsBrinkbitPermissions() {
    return db.connect()
    .then(() => Promise.resolve({
        verify,
        conn,
        Permissions,
    }));
};
