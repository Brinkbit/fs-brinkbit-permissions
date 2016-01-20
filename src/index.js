'use strict';

const Permissions = require( './schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.file;
const Meta = s3Mongo.schema.meta;
const mongoose = require( 'mongoose' );
mongoose.Promise = global.Promise;

/* eslint no-shadow: 0 */

module.exports.verify = ( user, operation, fullPath ) => {
    function verifyPath( path, userId ) {
        let fileObj;
        File.findOne({ $and: [{ name: path }, { userId }] }).exec()
            .then(( obj ) => {
                if ( !obj ) {
                    throw new Error({
                        reason: 'INVALID_RESOURCE_PATH',
                    });
                }
                else {
                    fileObj = obj;
                    return obj.metaDataId;
                }
            })
            .then(( id ) => {
                // return the meta
                return Meta.findOne({ _id: id }).exec();
            })
            // figure out if this is the last parent and throw new Error
            .then(( meta ) => {
                if ( meta ) {
                    // figure out if this is the last parent and throw new Error
                    if ( !meta.children ) {
                        throw new Error({
                            reason: 'LAST PARENT',
                            lastParentPath: fileObj.name,
                            meta,
                        });
                    }
                }
                else {
                    throw new Error({
                        reason: 'INVALID_RESOURCE_PATH',
                    });
                }
            });
    }

    function verifyLastParent( meta, lastParentPath, fullPath, user ) {
        let fileExists;
        fileExists = ( lastParentPath === fullPath.split( '/' ).length );
        Meta.find({ $and: [{ guid: meta.guid }, { mimeType: 'folder' }] }).exec()
        .then(( folderFind ) => {
            // if this is not an exact match, and the last path was not a folder, we have a problem
            if ( !folderFind && fileExists ) {
                throw new Error( 'tried to add object to file' );
            }
            else {
                // get permissions
                return Permissions.find({ $and: [{ resourceId: meta._id }, { userId: user }] }).exec();
            }
        })
        .then(( permissions ) => {
            if ( permissions ) {
                throw new Error( 'user has no permissions on this object' );
            }
            else {
                // we now know where our path ends and what our user's permissions are on that end. time to test things
                // important vars:
                // fileExists
                // permissions

                // a file that already exists is required for some operations, and excluded for others
                // required for read, update, destroy
                if ( !fileExists && operation === 'read' || 'update' || 'destroy' ) {
                    throw new Error( 'object does not exist' );
                }

                // can't exist for write
                if ( fileExists && operation === 'write' ) {
                    throw new Error( 'object already exists at that path' );
                }

                // test permissions against various actions
                if ( operation === 'read' &&
                    !permissions.read ) {
                    throw new Error( 'user does not have read permissions on this object' );
                }
                if ( operation === 'write' || 'update' &&
                    !permissions.write ) {
                    throw new Error( 'user does not have write permissions on this object' );
                }
                if ( operation === 'destroy' &&
                    !permissions.destroy ) {
                    throw new Error( 'user does not have write permissions on this object' );
                }
            }
        });
    }
    //
    // AND HERE WE GO
    let currentPath = '';
    let meta;
    let lastParentPath;
    let pathArray;
    const promises = [];
    pathArray = fullPath.split( '/' );
    pathArray.forEach(( pathComponent ) => {
        currentPath += '/' + pathComponent;
        promises.push( verifyPath( currentPath, user ));
    });


    Promise.all( promises )
        .catch(( err ) => {
            // if this is not the last parent, then an error should produce an error
            // put here for brevity
            if ( err.reason !== 'LAST PARENT' ) {
                Promise.reject( err );
            }
            else {
                // we need the meta and last path
                meta = err.meta;
                lastParentPath = err.lastParentPath;
            }
        // this is the last parent. continue our logic
        })
        .then(() => {
            verifyLastParent( meta, lastParentPath, fullPath, user );
        })

        .then(() => {
            // if it gets this far it's succeeded!
            // return the parent path and remaining path
            Promise.resolve({
                lastParentPath,
                remainingPath: pathArray.slice( lastParentPath.split( '/' ), pathArray.length ),
            });
        })
        .catch(( err ) => {
            if ( err.reason !== 'LAST PARENT' ) {
                Promise.reject( err );
            }
        });
};
