'use strict';

/* eslint-env mocha */

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const sinonchai = require( 'sinon-chai' );
const MongooseObject = require( 'mongoose' ).Types.ObjectId;
const R = require( 'Ramda' );
chai.use( sinonchai );
chai.use( chaiaspromised );
const Permissions = require( '../src/schemas/permissionSchema.js' );
const fsPermissions = require( '../src/index.js' )();
const verify = fsPermissions.verify;


const path = [ 'level1', 'level2', 'level3', 'test.txt' ];
const acceptUser = new MongooseObject();
const rejectUser = new MongooseObject();
const testGuid = new MongooseObject();

// create the meta and permissions
const insertFixture = function insertFixture( pathVar ) {
    const good = {
        resourceId: testGuid,
        appliesTo: 'user',
        userId: acceptUser,
        groupId: null,
        read: true,
        write: true,
        destroy: true,
        manage: true,
    };

    const bad = R.clone( good );
    bad.userId = rejectUser;
    bad.read = bad.write = bad.destroy = bad.manage = false;

    const promises = pathVar.map(( value, index, array ) => {
        good.resourceType = bad.resourceType = index !== array.length ? 'folder' : 'file';

        const goodPermissions = new Permissions( good );
        const badPermissions = new Permissions( bad );

        return Promise.all([
            goodPermissions.save(),
            badPermissions.save(),
        ]);
    });
    return Promise.all( promises );
};


describe( 'verify', () => {
    beforeEach( done => {
        fsPermissions.connect()
        .then( insertFixture( path ))
        .then( done );
    });

    afterEach( done => {
        Permissions.remove({ resourceId: testGuid }).exec()
        .then(() => done());
    });

    it( 'should allow reading a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'read' )).to.be.fulfilled;
    });

    it( 'should reject reading a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'read' )).to.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow updating a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'update' )).to.be.fulfilled;
    });

    it( 'should reject updating a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'update' )).to.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow destroying a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'destroy' )).to.be.fulfilled;
    });

    it( 'should reject destroying a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'destroy' )).to.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow insertion of a file with correct permissions on the parent folder', () => {
        return expect( verify( testGuid, acceptUser, 'write' )).to.be.fulfilled;
    });

    it( 'should reject insertion of a file with incorrect permissions on the parent folder', () => {
        return expect( verify( testGuid, rejectUser, 'write' )).to.be.rejectedWith( 'NOT_ALLOWED' );
    });
});
