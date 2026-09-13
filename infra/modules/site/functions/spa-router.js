// SPA routing for the static site.
//
// apps/web uses BrowserRouter with the client-side routes `/` and `/dashboard`
// (apps/web/src/app/main.tsx, App.tsx). A request for /dashboard has no object
// behind it in S3, so it has to be answered with index.html and let the router
// take over.
//
// The obvious alternative — CloudFront `custom_error_response` mapping 403/404
// to /index.html — is wrong here, because custom error responses apply to the
// whole distribution, including the API origin. A genuine 404 from
// /v1/companies would come back as index.html with status 200: exactly the kind
// of silent failure AGENTS.md forbids. A function attached to the default
// behaviour only never sees a /v1/* request.
//
// The rule: a path whose last segment has no extension is a route, not a file.
// Every real asset the build emits has one — .js, .css, .json, .woff2, .svg.

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);

  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }

  return request;
}
