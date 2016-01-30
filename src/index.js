'use strict';

/* eslint no-shadow: 0 */
/* eslint no-else-return: 0 */
/* eslint new-cap: 0 */

const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const Permissions = require( './schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.file;
const Meta = s3Mongo.schema.meta;
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

function verifyPermissions( user, operation, meta, isParent ) {
    // sanity check - verify the meta exists
    if ( !meta ) {
        return Promise.reject( 'RESOURCE_NOT_FOUND' );
    }
    // if this is a parent, we need to make sure it's a folder
    else if ( isParent && meta.mimeType !== 'folder' ) {
        return Promise.reject( 'NOT_ALLOWED' );
    }
    // if it passes all the above, return the permissions
    else {
        // get the permissions
        return Permissions.findOne({ $and: [{ resourceId: meta._id }, { userId: mongoose.Types.ObjectId( user ) }] }).exec()
        .then(( permissions ) => {
            if ( !permissions ) {
                return Promise.reject( 'NOT_ALLOWED' );
            }
            else {
                // time to run the permissions
                if ( operation === 'read' && !permissions.read ) {
                    return Promise.reject( 'NOT_ALLOWED' );
                }
                else if ( operation === 'write' || 'update' && !permissions.write ) {
                    return Promise.reject( 'NOT_ALLOWED' );
                }
                else if ( operation === 'destroy' && !permissions.destroy ) {
                    return Promise.reject( 'NOT_ALLOWED' );
                }
                else {
                    // if we've made it this far, we're good to go!
                    return Promise.resolve();
                }
            }
        });
    }
}

module.exports.connect = mongoConnect();

module.exports.verify = ( user, operation, fullPath ) => {
    return new Promise(( resolve, reject ) => {
        // connect to mongo
        mongoConnect()
            .then(() => {
                // find a file record pointing to the meta
                return File.findOne({ name: fullPath }).exec();
            })
            .then(( file ) => {
                // if there's no file, the meta clearly doesn't exist
                if ( !file ) {
                    return null;
                }
                else {
                    return Meta.findById( file.metaDataId ).exec();
                }
            })
            .then(( meta ) => {
                // an object must exist for certain operations
                if ( !meta && ( operation === 'read' || 'update' || 'destroy' )) {
                    return Promise.reject( 'RESOURCE_NOT_FOUND' );
                }

                // can't exist for write
                else if ( meta && operation === 'write' ) {
                    return Promise.reject( 'RESOURCE_EXISTS' );
                }

                // if this object exists, perform verification on the object
                if ( meta ) {
                    return verifyPermissions( user, operation, meta, false );
                }
                // otherwise perform verification on the parent
                else {
                    return File.findOne({ name: fullPath.split( '/' ).pop() }, { userId: user }).exec()
                        .then(( file ) => {
                            // if there's no file, the meta clearly doesn't exist
                            if ( !file ) {
                                return Promise.reject( 'RESOURCE_NOT_FOUND' );
                            }
                            else {
                                return Meta.findById( file.metaDataId ).exec();
                            }
                        })
                        .then(( meta ) => {
                            return verifyPermissions( user, operation, meta, true );
                        });
                }
            })
            .then(() => {
                resolve();
            })
            .catch(( e ) => {
                reject( e );
            });
    });
};
