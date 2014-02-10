module.exports = function(grunt) {

  var glob = {
    projName: 'PROJECTNAME'
  };

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    /**
     * Concatenate javascript files
     */
    concat: {
      options: {
        separator: ';'
      },
      js: {
        src: ['src/js/**/*.js'],
        dest: 'website/static/js/<%= glob.projName  %>.app.js'
      }
    },

    /**
     * JSHint all javascript files
     */
    jshint: {
      files: ['Gruntfile.js', 'src/js/**/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true,
          _: true,
          angular: true,
          Class: true
        }
      }
    },


    /**
     * Compile LESS into a single CSS file
     */
    less: {
      options: {
          paths: ["src/less"]
      },
      dev: {
        files: {
          "website/static/css/<%= glob.projName  %>.css": "src/less/bootstrap/bootstrap.less"
        }
      },
      prod: {
        files: {
          "website/static/css/<%= glob.projName  %>.css": "src/less/bootstrap/bootstrap.less"
        },
        options: {
          cleancss: true
        }
      }
    },

    /**
     * Minimize JS code
     */
    uglify: {
      main: {
        options: {
          compress: {
            drop_console: true
          }
        },
        files: {
          'website/static/js/<%= glob.projName  %>.app.js': ['website/static/js/<%= glob.projName  %>.app.js']
        }
      }
    },

    /**
     * Copy vendor files & images to static
     */
    copy: {
      main: {
        files: [
          {expand: true, cwd: 'src/', src: ['vendors/**'], dest:'website/static/'},
          {expand: true, cwd: 'src/', src: ['img/**'], dest:'website/static/'},
        ]
      }
    },

    /**
     * Optimize
     * @type {Object}
     */
    imagemin: {
      main: {
        options: {
          optimizationLevel: 2,
          cache: false
        },
        files: [
          {expand: true, cwd: 'src/img/', src:['**/*.{png,jpg,gif}'], dest:'website/static/img'}
        ]
      }
    },

    /**
     * Clean / Empty static directory before every grunt event
     */
    clean: {
      main: ['website/static/']
    },

    /**
     * Watches a set of directories for changes
     */
    watch: {
      files: ['<%= jshint.files %>', 'src/less/**'],
      tasks: ['jshint', 'concat', 'less:dev']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-less');

  grunt.registerTask('default', ['jshint', 'less:dev', 'concat']);

  // Deploy steps
  // 0. Empty destination folder
  // 1. Compile LESS to CSS(minified) into dest/css
  // 2. JSHint Js,
  // 3. Concat JS, into dest/js
  // 4. Uglify JS from dest/js into dest/js
  // 5. Optimize src/img/* into dest/img
  // 6. Copy src/vendors into dest/
  grunt.registerTask('build', ['clean', 'less:prod', 'jshint', 'concat', 'uglify', 'copy', 'imagemin']);




};