'use strict';

/* eslint-env mocha */
/* eslint new-cap: 0 */
/* eslint no-unused-expressions: 0 */
// todo: remove this after finishing tests
/* eslint no-unused-vars: 0 */
/* eslint no-shadow: 0 */

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const sinonchai = require( 'sinon-chai' );
const mime = require( 'mime' );
const mongoose = require( 'mongoose' );
const Permissions = require( '../src/schemas/permissionSchema.js' );
const fsPermissions = require( '../src/index.js' );
const verify = fsPermissions.verify;

chai.use( sinonchai );
chai.use( chaiaspromised );

// HARDCODED FIXTURE VERSION
// create the path
const path = [ 'level1', 'level2', 'level3', 'test.txt' ];
// stub the userid
let acceptUser = new mongoose.Types.ObjectId();
let rejectUser = new mongoose.Types.ObjectId();
const testGuid = 'TESTGUID';

// create the meta and permissions
const insertFixture = function insertFixture( pathVar ) {
    // for each level:
    const promises = pathVar.map(( value, index, array ) => {
                // create the permission record for the good user
        const goodPermissions = new Permissions({
            get resourceType() {
                let resourceType;
                if ( index !== array.length ) {
                    resourceType = 'folder';
                }
                else {
                    resourceType = 'file';
                }
                return resourceType;
            },  // project or file/folder and we can easily add additional resource types later
            resourceId: testGuid, // links to metadata id or project id
            appliesTo: 'user', // 'user', 'group', 'public'
            userId: acceptUser,
            groupId: null, // if applies to group
            read: true,
            write: true,
            destroy: true,
            // share: [String], add additional user with default permissions for collaboration
            manage: true, // update/remove existing permissions on resource
        });
        const badPermissions = new Permissions({
            get resourceType() {
                let resourceType;
                if ( index !== array.length ) {
                    resourceType = 'folder';
                }
                else {
                    resourceType = 'file';
                }
                return resourceType;
            },  // project or file/folder and we can easily add additional resource types later
            resourceId: testGuid, // links to metadata id or project id
            appliesTo: 'user', // 'user', 'group', 'public'
            userId: rejectUser,
            groupId: null, // if applies to group
            read: false,
            write: false,
            destroy: false,
            // share: [String], add additional user with default permissions for collaboration
            manage: false, // update/remove existing permissions on resource
        });
        // create the good file record
        return Promise.all([
            goodPermissions.save(),
            badPermissions.save(),
        ]);
    })
    .catch(( e ) => {
        return Promise.reject( e );
    });
    return Promise.all( promises );
};


describe( 'verify', ( ) => {
    beforeEach( function beforeEach( done ) {
        return insertFixture( path )
        .then(() => {
            done();
        })
        .catch(( e ) => {
            throw ( e );
        });
    });


    afterEach( function afterEach( done ) {
        Permissions.remove({ resourceId: 'TESTGUID' }).exec()
        .then(() => {
            done();
        })
        .catch(( e ) => {
            throw ( e );
        });
    });

    // userId, path, operation
    acceptUser = acceptUser.toString();
    rejectUser = rejectUser.toString();
    it( 'should allow reading a file with correct permissions', () => {
        return expect( verify( acceptUser, 'read', testGuid )).to.be.fulfilled;
    });
    it( 'should reject reading a file with incorrect permissions', () => {
        return expect( verify( rejectUser, 'read', testGuid ))
            .to.be.rejectedWith( 'NOT_ALLOWED' );
    });
    it( 'should allow updating a file with correct permissions', () => {
        return expect( verify( acceptUser, 'update', testGuid )).to.be.fulfilled;
    });
    it( 'should reject updating a file with incorrect permissions', () => {
        return expect( verify( rejectUser, 'update', testGuid ))
            .to.be.rejectedWith( 'NOT_ALLOWED' );
    });
    it( 'should allow destroying a file with correct permissions', () => {
        return expect( verify( acceptUser, 'destroy', testGuid )).to.be.fulfilled;
    });
    it( 'should reject destroying a file with incorrect permissions', () => {
        return expect( verify( rejectUser, 'destroy', testGuid ))
            .to.be.rejectedWith( 'NOT_ALLOWED' );
    });
    it( 'should allow insertion of a file with correct permissions on the parent folder', () => {
        return expect( verify( acceptUser, 'write', testGuid )).to.be.fulfilled;
    });
    it( 'should reject insertion of a file with incorrect permissions on the parent folder', () => {
        return expect( verify( rejectUser, 'write', testGuid ))
            .to.be.rejectedWith( 'NOT_ALLOWED' );
    });
});
