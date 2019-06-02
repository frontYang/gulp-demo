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
// const rename = require('gulp-rename'); // 重命名，主要用来命名压缩文件
const proxyMiddleware = require('http-proxy-middleware'); // 反向代理
const gulpif = require('gulp-if'); // 判断
const rev = require('gulp-rev'); // 增加md5版本号
const revCollector = require('gulp-rev-collector'); // 替换版本号链接

// 环境变量
const env = process.env.NODE_ENV.replace(/\s+/g, "");

// 构建文件夹
const baseDir = env == 'dev' ? './dist' : './public';

// 需代理的接口域名
const apiDomain = [
  {
    target: 'http://a.111.com',
    file: '/api',
    pathRewrite: {
      '^/api': '/api'
    }
  },
  {
    target: 'http://localhost:8091',
    file: '/api',
    pathRewrite: {
      '^/api': '/api'
    }
  }
];

// mock数据主域
const host = 'localhost';

const config = {
  baseDir: baseDir,
  libDir: {
    src: 'src/lib/**/*',
    dest: baseDir + '/lib/'
  },
  viewsDir: {
    src: 'src/views/**/*',
    dest: baseDir + '/views/'
  },
  cssDir: {
    src: 'src/css/*.scss',
    src_all: 'src/css/**/*.scss',
    css_all: 'src/css/**/*.css',
    dest: baseDir + '/css'
  },
  jsDir: {
    src: 'src/js/**/*.js',
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
    dest: 'src/images',
    dest_icon: 'src/images'
  },
  mockDir: './data'
}


// 服务器
gulp.task('browserSync', function(){
  // 跨域反向代理
  var middleware = function(){
    var middle = []

    for(var i = 0; i < apiDomain.length; i++){
      middle.push(proxyMiddleware(apiDomain[i].file, {
        target: apiDomain[i].target,
        changeOrigin: true,             // for vhosted sites, changes host header to match to target's host
        logLevel: 'debug',
        pathRewrite: apiDomain[i].pathRewrite
      }))
    }
    return middle
  }

  browserSync.init({
      server: {
          baseDir: config.baseDir,
          port: 3000,
          middleware: middleware(),
      },
      startPath: ''
  });
})

// mock数据
gulp.task('mock', function(){
  return gulp.src(config.mockDir)
    .pipe(mockServer({
      port: 8091,
      host: host,
      allowCrossOrigin: true,
      open: true
    }))
})


// 拷贝lib
gulp.task('lib',  function() {
  return gulp.src(config.libDir.src)
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest(config.libDir.dest))
});

// 拷贝views
gulp.task('views',  function() {
  return gulp.src(config.viewsDir.src)
    .pipe(contentIncluder({
        includerReg:/<!\-\-\#include\s+virtual="([^"]+)"\-\->/g
    }))
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest(config.viewsDir.dest))
});

// sass编译
gulp.task('sass', ['spritesmith', 'images'], function(){
  return gulp.src(config.cssDir.src)
    .pipe(sass({outputStyle: 'compact'}).on('error', sass.logError))
    .pipe(dgbl())
    .pipe(postcss([autoprefixer({browsers: ['last 2 versions', 'Android > 4.4','iOS >= 8', 'Firefox >= 20', 'ie >= 7']})]))
    .pipe(reload({ stream: true}))
    .pipe(gulpif(env != 'dev', cleanCss(({compatibility: 'ie7'}))))
    .pipe(gulpif(env != 'dev', rev()))
    .pipe(gulp.dest(config.cssDir.dest))
    .pipe(gulpif(env != 'rev', rev.manifest('./rev/rev-manifest.json', {
      base: './rev',
      merge: true
    })))
    .pipe(gulp.dest('./rev'))
})

// es6编译(模块语法不支持)
gulp.task('babel', function(){
  return gulp.src(config.jsDir.src)
    .pipe(babel({
      presets: ['@babel/env'],
      plugins: ['@babel/transform-runtime']
    }))

    .pipe(reload({ stream: true}))
    .pipe(gulpif(env != 'dev',uglify()))
    .pipe(gulpif(env != 'dev', rev()))
    // .pipe(gulpif(env != 'dev',rename({suffix: '.min'})))
    .pipe(gulp.dest(config.jsDir.dest))
    .pipe(gulpif(env != 'dev', rev.manifest('./rev/rev-manifest.json',{
      base: './rev',
      merge: true
    })))
    .pipe(gulpif(env != 'dev', gulp.dest('./rev')))
})

// 图片精灵+优化
gulp.task('spritesmith', function() {
  return gulp.src(config.imgDir.src_icon)
    .pipe(cache(imagemin({
      interlaced: true,
    })))
    .pipe(spritesmith({
        imgName: 'images/icons.png', //合并后大图的名称
        cssName: 'css/block/icons.scss',
        padding: 2, // 每个图片之间的间距，默认为0px
        cssFormat: 'css'
    }))
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest('src'))

});

// 图片优化
gulp.task('images', function() {
  return gulp.src(config.imgDir.src)
    .pipe(cache(imagemin({
      interlaced: true,
    })))
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest(config.imgDir.dest))
});

// 公共模块引用 + 静态文件版本号
gulp.task('html', ['sass', 'babel'], function() {
  return gulp.src(['./rev/*.json', 'src/index.html'])
    .pipe(contentIncluder({
        includerReg:/<!\-\-\#include\s+virtual="([^"]+)"\-\->/g
    }))
    .pipe(gulpif(env != 'dev', revCollector({
      replaceReved: true
    })))
    .pipe(reload({ stream: true}))
    .pipe(gulp.dest(config.htmlDir.dest))
});


// 清除文件
gulp.task('clean:dist', function() {
  return del.sync([
    ''+ baseDir +'/css',
    ''+ baseDir +'/js',
    ''+ baseDir +'/lib',
    ''+ baseDir +'/rev',
    ''+ baseDir +'/views',
    ''+ baseDir +'/*.html',
    ''+ baseDir +'/*.json',
    '!'+ baseDir +'/images'], {
      force: true
    })
});

// 清除缓存
gulp.task('clean', function() {
  return del.sync('dist').then(function(cb) {
    return cache.clearAll(cb);
  });
})

// 监听
gulp.task('watch', function() {
  gulp.watch(config.cssDir.src, ['sass']);
  gulp.watch(config.cssDir.src_all, ['sass']);
  gulp.watch(config.htmlDir.src_all, ['html', 'views']);
  gulp.watch(config.libDir.src, ['lib']);
  gulp.watch(config.viewsDir.src, ['views']);
  gulp.watch(config.jsDir.src, ['babel']);
})

// build
gulp.task('build', function(callback) {
  runSequence(
      ['clean:dist',
      'lib',
      'views'],
      'html',
    callback
  )
})

// dev
gulp.task('dev', function(callback) {
  runSequence([
    'clean:dist',
    'html',
    'lib',
    'views',
    'browserSync',
    'mock',
    ], 'watch',
    callback
  )
})