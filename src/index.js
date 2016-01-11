'use strict';

const Permissions = require( './schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.fileSchema;
const Meta = s3Mongo.schema.metaDataSchema;

/* eslint no-unused-vars: 0 */

module.exports.verify = ( user, operation, path ) => {
    let lastParent;
    let pathArray;
    let i;
    let folderFail;
    let isParent;
    let fileExists;
    let metaObj;
    let permissionsArray;
    let permissions;

    // josh/test/docs/sext.doc

    // first we need to find out how far down the path currently exists

    // make the path into an array
    // todo: need to remove the first part if we have an '/' up front
    pathArray = path.split( '/' );

    // start pathFind as an empty string
    lastParent = '';

    // iterate down the path,
    i = 0;
    folderFail = false;
    do {
        // add the next part of the path
        lastParent += '/' + pathArray[i];

        // store the fileid
        // i=2, lastParent = josh.test.children.docs.fileId
        metaObj = Meta.find({ _id: File.find({ name: lastParent }).metaDataId });

        // see if this is a folder
        if ( !Meta.find({ $and: [{ guid: metaObj.guid }, { mimeType: 'folder' }] })) {
            folderFail = true;
        }

        // run the test
        if ( metaObj && metaObj.children ) {
            isParent = true;
        }
        else {
            isParent = false;
        }
        // if there's another level and this was not a folder, we have a problem
        if ( isParent && folderFail ) {
            return new Promise(( resolve, reject ) => {
                reject( 'tried to add object to file' );
            });
        }

        // if there is another level, increment
        if ( isParent ) i++;
    } while ( isParent );

    // determine if the file exists, eg, is an exact match
    fileExists = ( i === pathArray.length );

    // if this is not an exact match, and the last path was not a folder, we have a problem
    if ( !fileExists && folderFail ) {
        return new Promise(( resolve, reject ) => {
            reject( 'tried to add object to file' );
        });
    }

    // get permissions for the user on the last parent
    permissionsArray = Permissions.find({ resourceId: metaObj._id });
    permissionsArray.forEach(( item ) => {
        if ( user === item.userId ) {
            permissions = item.permissions;
        }
    });

    // we now know where our path ends and what our user's permissions are on that end. time to test things
    // important vars:
    // fileExists
    // permissions

    // a file that already exists is required for some operations, and excluded for others
    // required for read, update, destroy
    if ( !fileExists && operation === 'read' || 'update' || 'destroy' ) {
        return new Promise(( resolve, reject ) => {
            reject( 'object does not exist' );
        });
    }

    // can't exist for write
    if ( fileExists && operation === 'write' ) {
        return new Promise(( resolve, reject ) => {
            reject( 'object already exists at that path' );
        });
    }

    // test permissions against various actions
    if ( operation === 'read' &&
        permissions.indexOf( 'read' ) === -1 ) {
        return new Promise(( resolve, reject ) => {
            reject( 'user does not have read permissions on this object' );
        });
    }
    if ( operation === 'write' || 'update' || 'destroy' &&
        permissions.indexOf( 'write' ) === -1 ) {
        return new Promise(( resolve, reject ) => {
            reject( 'user does not have write permissions on this object' );
        });
    }

    // if it gets this far it's succeeded!
    // return the parent path and remaining path
    return new Promise(( resolve ) => {
        resolve({
            lastParent,
            remainingPath: pathArray.slice( i + 1, pathArray.length ),
        });
    });
};
