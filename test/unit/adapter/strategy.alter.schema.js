var Waterline = require('../../../lib/waterline');
var assert = require('assert');
var _ = require('@sailshq/lodash');

describe('Alter Mode Recovery with an enforced schema', function () {

  var record;

  // Create an adapter and set some existing data
  before(function (done) {

    // Hold data to be used in tests
    var persistentData = [{
      id: 1,
      name: 'batman',
      car: 'batmobile',
      age: 50
    }];

    var adapter = {
      registerConnection: function (connection, collections, cb) {
        cb(null, null);
      },
      define: function (connectionName, collectionName, definition, cb) {
        this.describe(connectionName, collectionName, function (err, schema) {
          cb(null, schema);
        });
      },
      describe: function (connectionName, collectionName, cb, connection) {
        var schema = {
          name: { type: 'string' },
          age: { type: 'number' }
        };
        cb(null, (persistentData.length === 1) ? schema : undefined);
      },
      find: function (connectionName, collectionName, options, cb, connection) {

        if(!options.select && !options.where) {
          return cb(null, persistentData);
        }

        var results;
        if(!options.where) {
          results = persistentData;
        }
        else {
          results = _.find(persistentData, options.where);
        }
        // Psuedo support for select (needed to act like a real adapter)
        if(options.select && _.isArray(options.select) && options.select.length) {

          // Force ID in query
          options.select.push('id');

          results = _.map(results, function(result) {
            return _.pick(result, options.select);
          });
        }

        cb(null, results);
      },
      create: function (connectionName, collectionName, data, cb, connection) {
        var schemaData = _.pick(data, ['id', 'name', 'age']);
        persistentData.push(schemaData);
        cb(null, data);
      },
      drop: function (connectionName, collectionName, relations, cb, connection) {
        persistentData = [];
        cb(null);
      }
    };

    var waterline = new Waterline();

    // Build up a model to test
    var PersonModel = {
      identity: 'Person',
      tableName: 'person_table',
      connection: 'test_alter',
      migrate: 'alter',
      adapter: 'fake',
      schema: true,
      attributes: {
        name: 'string',
        age: 'integer',
        id: 'integer'
      }
    };

    // Create a connection using the stub adapter we created above
    var connections = {
      'test_alter': {
        adapter: 'fake'
      }
    };

    // Build up the named adapters object
    var adapters = {fake: adapter};

    // Build the collections and find the record
    var PersonCollection = Waterline.Collection.extend(PersonModel);
    waterline.loadCollection(PersonCollection);
    waterline.initialize({adapters: adapters, connections: connections}, function (err, data) {
      if (err) return done(err);
      data.collections.person.findOne({id: 1}, function (err, found) {
        if (err) return done(err);
        record = found;
        done();
      });
    });
  });


  it('should keep data already in the data store', function() {
    assert(record);
  });

  it('should include the attributes in the schema', function() {
    assert.equal(record.id, 1);
    assert.equal(record.name, 'batman');
    assert.equal(record.age, 50);
  });

  it('should not include the attributes NOT in the schema', function() {
    assert(!record.car);
  });

});
