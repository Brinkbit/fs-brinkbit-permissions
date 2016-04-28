'use strict';

const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const Permissions = require( './schemas/permissionSchema.js' );

const connect = () => {
    return new Promise(( resolve, reject ) => {
        // Already connected?
        if ( conn.readyState === 1 ) return resolve();

        // if not, connect
        const IP = process.env.NODE_ENV === 'development' ? process.env.ip : 'localhost';
        mongoose.connect( `mongodb://${IP}:27017` );
        conn.on( 'error', ( err ) => reject( err ));
        conn.on( 'connected', resolve );
    });
};


const verify = ( guid, userId, operation ) => {
    return Permissions.findOne({ $and: [{ userId }, { resourceId: guid }] }).exec()
    .then( permissions => {
        // Check for returned permissions, and that it matches the operation
        if ( !permissions || ( operation === 'read' && !permissions.read ) || (( operation === 'write' || operation === 'update' ) && !permissions.write ) || ( operation === 'destroy' && !permissions.destroy )) {
            return Promise.reject( 'NOT_ALLOWED' );
        }
    })
    .catch( err => Promise.reject( err ));
};

module.exports = () => {
    return {
        verify,
        connect,
    };
};
