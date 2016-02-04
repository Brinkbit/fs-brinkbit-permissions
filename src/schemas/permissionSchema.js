'use strict';

const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;

const permissionsSchema = new Schema({
    resourceType: String, // project or file/folder and we can easily add additional resource types later
    resourceId: Schema.Types.ObjectId, // links to metadata id or project id
    appliesTo: String, // 'user', 'group', 'public'
    userId: Schema.Types.ObjectId, // if applies to user
    groupId: Schema.Types.ObjectId, // if applies to group
    read: Boolean,
    write: Boolean,
    destroy: Boolean,
    share: [String], // add additional user with default permissions for collaboration
    manage: Boolean, // update/remove existing permissions on resource
});

module.exports = mongoose.model( 'Permissions', permissionsSchema );
