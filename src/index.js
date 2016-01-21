'use strict';

const Permissions = require( './schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.file;
const Meta = s3Mongo.schema.meta;
const mongoose = require( 'mongoose' );
mongoose.Promise = global.Promise;

/* eslint no-shadow: 0 */

function verifyPermissions( user, operation, file, isParent ) {
    // sanity check - verify the meta exists
    return Meta.find({ _id: file.metaDataId }).exec()
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
                return Permissions.find({ $and: [{ resourceId: meta._id }, { userId: user }] }).exec();
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

module.exports.verify = ( user, operation, fullPath ) => {
    // determine if this file (full path) currently exists
    File.findOne({ $and: [{ name: fullPath }, { userId: user }] }).exec()
    .then(( file ) => {
        // a file must exist for certain operations
        if ( !file && operation === 'read' || 'update' || 'destroy' ) {
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
    });
};
