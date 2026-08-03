#!/bin/sh
# Give Docker DNS time to propagate service names
sleep 5
exec nginx -g 'daemon off;'
