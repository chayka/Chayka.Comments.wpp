'use strict';

module.exports = function(grunt) {

    var resFiles = {
        less: ['res/src/css/**/*.less'],
        css: ['res/tmp/css/**/*.css'],
        js: ['res/src/js/**/*.js'],
        img: ['res/src/js/**/*.{png,jpg,gif}'],

        lessNg: ['res/src/ng-modules/**/*.less'],
        cssNg: ['res/src/ng-modules/*.css'],
        jsNg: ['res/src/ng-modules/*.js']
    };

    var chayka = grunt.file.readJSON('chayka.json');
    var isPlugin = chayka.appType === 'plugin';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // styles:
        less: {
            development:{
                expand: true,
                flatten: true,
                src: 'res/src/css/*.less',
                dest: 'res/src/css/',
                ext: '.css'
                //'res/tmp/css/less.css': resFiles.less
            },
            developmentNg:{
                expand: true,
                flatten: true,
                src: 'res/src/ng-modules/*.less',
                dest: 'res/src/ng-modules/',
                ext: '.css'
            }
        },
        autoprefixer: {
            options: {
                browsers: ['last 2 versions']
            },
            development: {
                src: resFiles.css.concat(resFiles.cssNg)
            }
        },
        csslint: {
            options: {
                csslintrc: '.csslintrc'
            },
            development: {
                src: resFiles.css.concat(resFiles.cssNg)
            }
        },
        cssmin: {
            ng: {
                expand: true,
                flatten: true,
                src: 'res/src/ng-modules/*.css',
                dest: 'res/dist/ng-modules/'
            }
        },
        concat: {
            options: {
                // define a string to put between each file in the concatenated output
                //separator: ';\n'
            },
            theme: {
                // the files to concatenate
                files:{
                    'style.css':[
                        'res/src/theme-header.css',
                        'res/tmp/css/min.css'
                    ]
                }
            }
        },

        //  scripts:
        jshint: {
            options: {
                jshintrc: true
            },
            all: {
                src: resFiles.js.concat(resFiles.jsNg).concat('Gruntfile.js')
            }
        },
        uglify: {
            options: {
                mangle: false
            },
            production: {
                expand: true,
                flatten: true,
                src: 'res/src/ng-modules/*.js',
                dest: 'res/dist/ng-modules/'
            }
        },

        //  images:
        imagemin: {                          
            dynamic: {                         
                files: [{
                    expand: true,               
                    cwd: 'res/src/img/',        
                    src: ['**/*.{png,jpg,gif}'],
                    dest: 'res/dist/img/'       
                }]
            }
        },

        //  common:
        clean: {
            css: ['res/tmp/css'],
            js: ['res/tmp/js'],
            img: ['res/tmp/img'],
            all: ['res/tmp']
        },
        watch: {
            js: {
                files: resFiles.jsNg,
                tasks: ['js']
            },
            less: {
                files:  resFiles.lessNg,
                tasks: ['css']
            },
            img: {
                files:  resFiles.img,
                tasks: ['img']
            }
        }
    });

    // Load NPM tasks
    require('load-grunt-tasks')(grunt);

    // Making grunt default to force in order not to break the project.
    grunt.option('force', true);

    grunt.registerTask('css-theme', ['less', 'autoprefixer', 'csslint', 'cssmin:ng', 'concat:theme', 'clean:css']);

    grunt.registerTask('css-plugin', ['less', 'autoprefixer', 'csslint', 'cssmin:ng', 'clean:css']);

    grunt.registerTask('css', isPlugin?['css-plugin']:['css-theme']);

    grunt.registerTask('js', ['jshint', 'uglify', 'clean:js']);

    grunt.registerTask('img', ['imagemin']);

    grunt.registerTask('default', ['css', 'js', 'img', 'clean:all']);

};