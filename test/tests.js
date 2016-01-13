'use strict';

/* eslint-env mocha */
/* eslint new-cap: 0 */
/* eslint no-unused-expressions: 0 */
// todo: remove this after finishing tests
/* eslint no-unused-vars: 0 */

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const sinonchai = require( 'sinon-chai' );
const mime = require( 'mime' );
const mongoose = require( 'mongoose' );
const Permissions = require( '../src/schemas/permissionSchema.js' );
const s3Mongo = require( 'fs-s3-mongo' );
const File = s3Mongo.schema.fileSchema;
const Meta = s3Mongo.schema.metaDataSchema;

chai.use( sinonchai );
chai.use( chaiaspromised );

// HARDCODED FIXTURE VERSION
// create the path
const path = [ 'level1', 'level2', 'level3', 'test.txt' ];
// stub the userid
const userId = mongoose.Types.ObjectId();

// create the meta and permissions
const insertFixture = function insertFixture( pathVar, userIdVar ) {
    // for each level:
    pathVar.forEach(( value, index, array ) => {
        // create the meta
        const meta = new Meta({
            guid: 'TESTDATA', // s3 guid
            get mimeType() {
                let mimeVar;
                if ( index === array.length ) {
                    mimeVar = mime.lookup( value.split( '.' ).pop());
                }
                else {
                    mimeVar = 'folder';
                }
                return mimeVar;
            },
            size: 12345678,
            dateCreated: new Date(), // https://docs.mongodb.org/v3.0/reference/method/Date/
            lastModified: new Date(), // https://docs.mongodb.org/v3.0/reference/method/Date/
            get children() {
                if ( index !== array.length ) {
                    return array[index + 1];
                }
            },
        });
        meta.save();
    // create the permission record
        const permissions = new Permissions({
            get resourceType() {
                let resourceType;
                if ( meta.mimeType === 'folder' ) {
                    resourceType = 'folder';
                }
                else {
                    resourceType = 'file';
                }
                return resourceType;
            },  // project or file/folder and we can easily add additional resource types later
            resourceId: meta.id, // links to metadata id or project id
            appliesTo: 'user', // 'user', 'group', 'public'
            userIdVar,
            groupId: null, // if applies to group
            read: true,
            write: true,
            destroy: true,
            // share: [String], add additional user with default permissions for collaboration
            manage: true, // update/remove existing permissions on resource
        });
        permissions.save();
    // create the file record
        const file = new File({
            metaDataId: meta.id, // link to METADATA
            userId: userIdVar, // link to User Collection
            get name() {
                return array.join( '/' ).slice( 0, index );
            },
            get parent() {
                return array.join( '/' ).slice( 0, index - 1 );
            },
        });
        file.save();
    });
};
