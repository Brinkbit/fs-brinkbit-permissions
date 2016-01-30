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

function verifyPermissions( user, operation, file, isParent ) {
    // sanity check - verify the meta exists
    return Meta.findById( file.metaDataId ).exec()
        .then(( meta ) => {
            // if the meta does not exist, something has gone very wrong
            if ( !meta ) {
                return Promise.reject( 'INVALID_RESOURCE' );
            }
            // if this is a parent, we need to make sure it's a folder
            else if ( isParent && meta.mimeType !== 'folder' ) {
                return Promise.reject( 'PARENT_IS_NOT_A_FOLDER' );
            }
            // if it passes all the above, return the permissions
            else {
                // get the permissions
                return Permissions.findOne({ $and: [{ resourceId: meta._id }, { userId: mongoose.Types.ObjectId( user ) }] }).exec();
            }
        })
        .then(( permissions ) => {
            if ( !permissions ) {
                return Promise.reject( 'USER_HAS_NO_PERMISSIONS_ON_THIS_OBJECT' );
            }
            else {
                // time to run the permissions
                if ( operation === 'read' &&
                    !permissions.read ) {
                    return Promise.reject( 'USER_DOES_NOT_HAVE_READ_PERMISSIONS_ON_THIS_OBJECT' );
                }
                else if ( operation === 'write' || 'update' &&
                    !permissions.write ) {
                    return Promise.reject( 'USER_DOES_NOT_HAVE_WRITE_PERMISSIONS_ON_THIS_OBJECT' );
                }
                else if ( operation === 'destroy' &&
                    !permissions.destroy ) {
                    return Promise.reject( 'USER_DOES_NOT_HAVE_DESTROY_PERMISSIONS_ON_THIS_OBJECT' );
                }
                else {
                    // if we've made it this far, we're good to go!
                    return Promise.resolve();
                }
            }
        });
}

module.exports.connect = mongoConnect();

module.exports.verify = ( user, operation, fullPath ) => {
    return new Promise(( resolve, reject ) => {
        // connect to mongo
        mongoConnect()
            .then(() => {
                // determine if this file (full path) currently exists
                return File.findOne({ $and: [{ name: fullPath }, { userId: mongoose.Types.ObjectId( user ) }] }).exec();
            })
            .then(( file ) => {
                // a file must exist for certain operations
                if ( !file && ( operation === 'read' || 'update' || 'destroy' )) {
                    return Promise.reject( 'object does not exist' );
                }

                // can't exist for write
                else if ( file && operation === 'write' ) {
                    return Promise.reject( 'object already exists at that path' );
                }

                // if this is a file, perform verification on the file
                if ( file ) {
                    return verifyPermissions( user, operation, file, false );
                }
                // otherwise perform verification on the parent
                else {
                    return File.findOne({ $and: [{ name: fullPath.split( '/' ).pop() }, { userId: user }] }).exec()
                        .then(( file ) => {
                            // if the parent does not exist, we have a problem
                            if ( !file ) {
                                return Promise.reject( 'INVALID_RESOURCE_PATH' );
                            }
                            else {
                                return verifyPermissions( user, operation, file, true );
                            }
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
