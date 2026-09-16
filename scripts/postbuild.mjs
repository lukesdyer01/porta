import { copyFileSync } from 'node:fs'
// GitHub Pages returns its own 404 page for any path it has no file for.
// Serving a copy of index.html as 404.html makes those paths boot the app.
copyFileSync('dist/index.html', 'dist/404.html')
console.log('postbuild: dist/404.html written')
