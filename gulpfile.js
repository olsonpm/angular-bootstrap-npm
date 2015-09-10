/**
 * Created by jopitz on 12/15/2014.
 */

var gulp   = require( 'gulp' ),
	rimraf = require( 'gulp-rimraf' ),
	exec   = require( 'gulp-exec' ),
	insert = require( 'gulp-insert' ),
	seq    = require( 'run-sequence' ),
	rename = require( 'gulp-rename' ),
	argv   = require( 'yargs' ).argv,
	svn	   = require('svn-interface'),
	stp    = require('stream-to-promise'),
	bPromise = require('bluebird'),

	_comma = 'commafix: tired of the hassle of remembering to add/remove a comma for the last var'

///////////////////////
//	TASK DECLARATIONS
///////////////////////

var ver = argv.ver ? '#' + argv.ver : '';
var tpls = (argv.excludeTpls) ? '' : '-tpls';
var vs = ver || 'latest';
var src = argv.src;


console.log( 'version: ', vs )

gulp.task( 'init', task_init)

gulp.task( 'curl', task_curl.bind(null, argv.ver, tpls))

gulp.task( 'svn-templates', task_svnTemplates.bind(null, argv.ver, tpls) )

gulp.task( 'package', task_package.bind(null, tpls) )

gulp.task( 'rename', task_rename.bind(null, tpls) )

gulp.task( 'clean', task_clean )

///////////////////////
//  TASK FUNCTIONS
///////////////////////

function task_init()
{
	return stp(gulp.src( [ './dist' ], { read: false } )
		.pipe( rimraf( { force: true } ) ));
}

function task_curl(ver, tpls)
{
	src = src || './tmp'

	var v = ver ||
			(function() {throw new Error( 'manually building requires a valid version number e.g. 0.13.0' )})()

	var norm = 'ui-bootstrap' + tpls + '-' + v + '.js';
	var mini = 'ui-bootstrap' + tpls +  '-' + v + '.min.js';

	return stp(gulp.src( '' )
		.pipe( exec( 'mkdir -p ./tmp && ' +
					 'curl -o ./tmp/' + norm + ' http://angular-ui.github.io/bootstrap/' + norm + ' && ' +
					 'curl -o ./tmp/' + mini + ' http://angular-ui.github.io/bootstrap/' + mini ) ))
}

function task_svnTemplates(ver, tpls)
{
	return new bPromise(function(resolve, reject) {
		try {
			if (!tpls) {
				svn.export('https://github.com/angular-ui/bootstrap/tags/' + ver + '/template ./dist/template', {}, function() {
					resolve();
				});
			}
		} catch (e) {
			reject(e);
		}
	});
}

function task_package(tpls)
{
	src = src || './node_modules/_tmp/dist'

	return stp(gulp.src( [ src + '/ui-bootstrap' + tpls + '-*.js' ] )
		.pipe( insert.append( 'if(typeof module!==\'undefined\')module.exports=\'ui.bootstrap\';' ) ) //just making this compatible with common-js packages for use w/ browserify
		.pipe( gulp.dest( './tmp' ) ))
}

function task_rename(tpls)
{
	var renameMin = stp(gulp.src( './tmp/*.min.js' )
		.pipe( rename( 'angular-bootstrap' + tpls + '.min.js' ) )
		.pipe( gulp.dest( './dist' ) ))
		
	var renameNormal = stp(gulp.src( [ './tmp/*.js', '!./tmp/*.min.js' ] )
		.pipe( rename( 'angular-bootstrap' + tpls + '.js' ) )
		.pipe( gulp.dest( './dist' ) ))
		
	return bPromise.join(renameMin, renameNormal);
}

function task_clean()
{
	return stp(gulp.src( [ './tmp', './node_modules/_tmp' ], { read: false } )
		.pipe( rimraf( { force: true } ) ));
}

///////////////////////
//	DEFAULT
///////////////////////

gulp.task( 'default', function() {
	var promiseSeq = [
		task_init,
		task_curl.bind(null, argv.ver, ''),
		task_curl.bind(null, argv.ver, '-tpls'),
		task_svnTemplates.bind(null, argv.ver, ''),
		task_package.bind(null, ''),
		task_package.bind(null, '-tpls'),
		task_rename.bind(null, ''),
		task_rename.bind(null, '-tpls'),
		task_clean
	];
	
	return bPromise.reduce(promiseSeq, function(_, task) {
			return task();
		}, null);
} )
