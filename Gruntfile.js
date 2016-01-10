module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  // Add the grunt-mocha-test tasks.
  [
    'grunt-mocha-test',
    'grunt-contrib-watch'
  ]
  .forEach( grunt.loadNpmTasks );

  grunt.initConfig({
    // Configure a mochaTest task
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js' ]
      },
    },

    watch: {
      options: {
          atBegin: true
      },
      scripts: {
        files: [ 'src/**/*.js', 'test/**/*.js' ],
        tasks: ['eslint', 'mochaTest' ]
      }
    },

    eslint: {
        target: [ 'src/**/*.js', 'test/**/*.js' ]
    }
  });

  grunt.registerTask( 'default', [ 'eslint' , 'mochaTest' ]);
  grunt.registerTask( 'debug', [ 'watch' ]);
};
