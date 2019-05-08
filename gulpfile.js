const gulp = require('gulp');
const browserSync = require('browser-sync'); // 自动刷新
const reload = browserSync.reload;
const sass = require('gulp-sass'); // 编译Sass
const postcss = require('gulp-postcss'); // 编译Sass
const autoprefixer = require('autoprefixer'); // css加前缀
const dgbl = require("del-gulpsass-blank-lines"); // 删掉sass空行
const cleanCss = require('gulp-clean-css'); // 压缩css
const babel = require('gulp-babel'); // bable
const uglify = require('gulp-uglify'); // 压缩js
const runSequence = require('run-sequence'); // 按照指定顺序运行任务
const contentIncluder = require('gulp-content-includer'); // include 公共模块
const imagemin = require('gulp-imagemin'); // 优化图片
const spritesmith = require('gulp.spritesmith'); // 图片精灵
const cache = require('gulp-cache'); // 缓存代理任务。，减少图片重复压缩
const del = require('del'); // 清理生成文件
const mockServer = require('gulp-mock-server'); // mock数据
const rename = require('gulp-rename'); // 重命名，主要用来命名压缩文件
const proxyMiddleware = require('http-proxy-middleware'); // 反向代理

var baseDir = './dist'
const config = {
  baseDir: baseDir,
  cssDir: {
    src: 'src/css/*.scss',
    dest: baseDir + '/css'
  },
  jsDir: {
    src_es6: 'src/js/**/*.js',
    src: 'src/lib/**/*.js',
    dest: baseDir + '/js'
  },
  htmlDir: {
    src: 'src/*.html',
    src_all: 'src/**/*.html',
    dest: baseDir + '/'
  },
  imgDir: {
    src:  'src/images/*.png',    
    src_icon: 'src/images/icons/*.png',
    dest: baseDir + '/images',
    dest_icon: baseDir + '/'
  },
  mockDir: './data/'
}

gulp.task('browserSync', function(){
  // 跨域反向代理
  var middleware = proxyMiddleware('/user_api', {
      target: 'http://passport.910app.com', // 需代理的域名
      changeOrigin: true,             // for vhosted sites, changes host header to match to target's host
      logLevel: 'debug',
      pathRewrite: {
          '^/user_api': '/user_api'
      }
  });

  browserSync.init({
      server: {
          baseDir: config.baseDir,
          port: 3000,
          middleware: [middleware],
      },
      startPath: '/'
  });
})

gulp.task('mock', function(){
  return gulp.src(config.mockDir)
    .pipe(mockServer({
      port: 8091,
      host: '192.168.3.24',
      allowCrossOrigin: true
    }))
})

gulp.task('sass', function(){
  return gulp.src(config.cssDir.src)
    .pipe(sass({outputStyle: 'compact'}).on('error', sass.logError))
    .pipe(dgbl())
    .pipe(postcss([autoprefixer({browsers: ['last 2 versions', 'Android > 4.4','iOS >= 8', 'Firefox >= 20', 'ie >= 7']})]))
    .pipe(gulp.dest(config.cssDir.dest))
    .pipe(reload({ stream: true}))
    .pipe(cleanCss(({compatibility: 'ie7'})))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(config.cssDir.dest))
})

gulp.task('babel', function(){  
  return gulp.src(config.jsDir.src_es6)
    .pipe(babel({
      presets: ['@babel/env'],
      plugins: ['@babel/transform-runtime']
    }))
    .pipe(gulp.dest(config.jsDir.dest))
    .pipe(reload({ stream: true}))
    .pipe(uglify())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(config.jsDir.dest))
})

gulp.task('scripts', function(){
  return gulp.src(config.jsDir.src)
    .pipe(gulp.dest(config.jsDir.dest))
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest(config.jsDir.dest))
})

gulp.task('concat',function() {
  return gulp.src(config.htmlDir.src)
    .pipe(contentIncluder({
        includerReg:/<!\-\-\#include\s+virtual="([^"]+)"\-\->/g
    }))
    .pipe(gulp.dest(config.htmlDir.dest))
    .pipe(reload({ stream: true}))
});

gulp.task('spritesmith', function() {
  return gulp.src(config.imgDir.src_icon)
    .pipe(cache(imagemin({
      interlaced: true,
    })))
    .pipe(spritesmith({
        imgName: 'images/icons.png', //合并后大图的名称
        cssName: 'css/block/icons.css',
        padding: 2// 每个图片之间的间距，默认为0px
    }))

    .pipe(gulp.dest(config.imgDir.dest_icon))
});

gulp.task('images', function() {
  return gulp.src(config.imgDir.src)
    .pipe(cache(imagemin({
      interlaced: true,
    })))

    .pipe(gulp.dest(config.imgDir.dest))
});

gulp.task('clean:dist', function() {
  return del.sync(['dist/**/*', '!dist/images', '!dist/images/**/*']);
});

gulp.task('clean', function() {
  return del.sync('dist').then(function(cb) {
    return cache.clearAll(cb);
  });
})

gulp.task('watch', function() {
  gulp.watch(config.cssDir.src, ['sass']);
  gulp.watch(config.jsDir.src_es6, ['babel']);
  gulp.watch(config.jsDir.src, ['scripts']);
  gulp.watch(config.htmlDir.src_all, ['concat']);
})

gulp.task('build', function(callback) {
  runSequence(
    'clean:dist',
    'images',
    'spritesmith',
    'sass',
    'babel',
    'scripts',
    'concat',     
    'mock',
    callback
  )
})

gulp.task('dev', function(callback) {
  runSequence([
    'clean:dist',
    'images',
    'spritesmith',
    'sass',
    'babel',
    'scripts',
    'concat',    
    'browserSync', 'mock'], 'watch',
    callback
  )
})