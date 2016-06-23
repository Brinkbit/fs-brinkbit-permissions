'use strict';

process.env.NODE_ENV = 'production';

/* eslint-env mocha */
/* eslint no-unused-vars: 0 */

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
chai.use( chaiaspromised );
const R = require( 'Ramda' );
const mongoose = require( 'mongoose' );
const MongooseObject = mongoose.Types.ObjectId;
const fsPermissions = require( '../src/index.js' );

const path = [ 'level1', 'level2', 'level3', 'test.txt' ];
const acceptUser = new MongooseObject();
const rejectUser = new MongooseObject();
const testGuid = new MongooseObject();

// create the meta and permissions
const insertFixture = function insertFixture( pathVar, Permissions ) {
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

let verify;
let conn;
let Permissions;
describe( 'verify', () => {
    before(( done ) => {
        fsPermissions()
        .then( funcs => {
            verify = funcs.verify;
            conn = funcs.conn;
            Permissions = funcs.Permissions;
        })
        .then(() => {
            done();
        });
    });

    beforeEach( done => {
        return insertFixture( path, Permissions )
        .then(() => {
            done();
        });
    });

    afterEach( done => {
        return Permissions.remove({ resourceId: testGuid }).exec()
        .then(() => {
            done();
        });
    });

    it( 'should allow reading a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'read' )).to.eventually.be.fulfilled;
    });

    it( 'should reject reading a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'read' )).to.eventually.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow updating a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'update' )).to.eventually.be.fulfilled;
    });

    it( 'should reject updating a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'update' )).to.eventually.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow destroying a file with correct permissions', () => {
        return expect( verify( testGuid, acceptUser, 'destroy' )).to.eventually.be.fulfilled;
    });

    it( 'should reject destroying a file with incorrect permissions', () => {
        return expect( verify( testGuid, rejectUser, 'destroy' )).to.eventually.be.rejectedWith( 'NOT_ALLOWED' );
    });

    it( 'should allow insertion of a file with correct permissions on the parent folder', () => {
        return expect( verify( testGuid, acceptUser, 'write' )).to.eventually.be.fulfilled;
    });

    it( 'should reject insertion of a file with incorrect permissions on the parent folder', () => {
        return expect( verify( testGuid, rejectUser, 'write' )).to.eventually.be.rejectedWith( 'NOT_ALLOWED' );
    });
});
