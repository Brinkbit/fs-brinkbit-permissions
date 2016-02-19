'use strict';

/* eslint no-shadow: 0 */
/* eslint no-else-return: 0 */
/* eslint new-cap: 0 */
/* eslint prefer-const: 0 */

const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const Permissions = require( './schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.file;
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
        // if this is a parent, we need to make sure it's a folder. don't want to insert one file into another
        // this should have already been caught, but doesn't hurt to double-chcek
    if ( isParent && file.mimeType !== 'folder' ) {
        return Promise.reject( 'NOT_ALLOWED' );
    }
        // if it passes all the above, return the permissions
    else {
        // get the permissions
        return Permissions.findOne({ $and: [{ resourceId: file._id }, { userId: mongoose.Types.ObjectId( user ) }] }).exec()
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
    }
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
                if ( !file && ( operation === 'read' ||
                    operation === 'update' ||
                    operation === 'destroy' )) {
                    return Promise.reject( 'RESOURCE_NOT_FOUND' );
                }

                // can't exist for write
                else if ( file && operation === 'write' ) {
                    return Promise.reject( 'RESOURCE_EXISTS' );
                }

                // if this is a file, perform verification on the file
                if ( file ) {
                    return verifyPermissions( user, operation, file, false );
                }
                // otherwise perform verification on the parent
                else {
                    let fullPathSplit = fullPath.split( '/' );
                    fullPathSplit.pop();
                    return File.findOne({ $and: [{ name: fullPathSplit.join( '/' ) + '/' }, { userId: user }] }).exec()
                        .then(( file ) => {
                            // if the parent does not exist, we have a problem
                            // this will also fire if we try to insert one file into another, because the
                            // trailing '/' will prevent the query from finding anything
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
