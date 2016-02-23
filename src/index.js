'use strict';

/* eslint no-shadow: 0 */
/* eslint no-else-return: 0 */
/* eslint new-cap: 0 */
/* eslint prefer-const: 0 */

const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const Permissions = require( './schemas/permissionSchema.js' );
mongoose.Promise = Promise;

function mongoConnect() {
    // check to see if we're already connected
    if ( conn.readyState === 1 ) {
        // if so, begin
        return Promise.resolve();
    }
    // if not, connect
    else {
        let mongoAddress;
        if ( process.env.NODE_ENV === 'development' ) {
            mongoAddress = 'mongodb://' + process.env.IP + ':27017';
        }
        else {
            mongoAddress = 'mongodb://localhost:27017';
        }

        mongoose.connect( mongoAddress );
        conn.on( 'error', ( err ) => {
            return Promise.reject( err );
        });

        conn.on( 'connected', () => {
            return Promise.resolve();
        });
    }
}


module.exports.connect = mongoConnect();

module.exports.verify = ( userId, operation, guid ) => {
    Permissions.findOne({ $and: [{ userId }, { guid }] }).exec()
            .then(( permissions ) => {
                if ( !permissions ) {
                    return Promise.reject( 'NOT_ALLOWED' );
                }
                else {
                    // time to run the permissions
                    if ( operation === 'read' &&
                        !permissions.read ) {
                        return Promise.reject( 'NOT_ALLOWED' );
                    }
                    else if ( operation === 'write' &&
                        !permissions.write ||
                        operation === 'update' &&
                        !permissions.write ) {
                        return Promise.reject( 'NOT_ALLOWED' );
                    }
                    else if ( operation === 'destroy' &&
                        !permissions.destroy ) {
                        return Promise.reject( 'NOT_ALLOWED' );
                    }
                    else {
                        // if we've made it this far, we're good to go!
                        return Promise.resolve();
                    }
                }
            })
            .catch(( e ) => {
                return Promise.reject( e );
            });
};
