vcl 4.1;

import std;

# Varnish stands in for a CDN in front of the app, which runs on the host.
# Varnish's built-in rules do the caching we want to show:
#   - only GET and HEAD are cached; POST goes straight to the app
#   - the cache key is the full URL, query string included
#   - the TTL comes from s-maxage before max-age
#   - Cache-Control no-store or private is never cached
backend app {
  .host = "host.docker.internal";
  .port = "3000";
}

sub vcl_recv {
  if (req.method != "GET" && req.method != "HEAD") {
    set req.http.X-CDN-Pass = "1";
  }
}

sub vcl_backend_response {
  # Varnish's default grace serves an expired copy for 10 more seconds while it
  # refetches in the background. Turned off so the first request after expiry
  # goes to the app, which is the behaviour the timeline demo shows.
  set beresp.grace = 0s;

  # Without a Cache-Control header Varnish would use its default TTL, so a 404
  # or a validation error would be cached. Only cache what the app marked.
  if (!beresp.http.Cache-Control) {
    set beresp.uncacheable = true;
    set beresp.ttl = 120s;
    return (deliver);
  }
}

# X-Cache-Info says in one line where the response came from, for example
#   CDN HIT | app not called | stored 20s ago | fresh for 40s more
#   CDN MISS | app | Redis MISS | 1 DB query
sub vcl_deliver {
  if (req.http.X-CDN-Pass) {
    set resp.http.X-CDN-Cache = "PASS";
    set resp.http.X-Cache-Info = "CDN PASS (" + req.method + " is not cached) | " + resp.http.X-Cache-Info;
  } else if (obj.hits > 0) {
    set resp.http.X-CDN-Cache = "HIT";
    set resp.http.X-Cache-Info = "CDN HIT | app not called | stored " + resp.http.Age +
      "s ago | fresh for " + std.integer(duration=obj.ttl) + "s more";
    # The app never saw this request, so its headers would describe an old one.
    unset resp.http.X-DB-Queries;
    unset resp.http.X-Cache-Status;
  } else if (resp.http.X-Cache-Info) {
    set resp.http.X-CDN-Cache = "MISS";
    set resp.http.X-Cache-Info = "CDN MISS | " + resp.http.X-Cache-Info;
  } else {
    set resp.http.X-CDN-Cache = "MISS";
  }
}
