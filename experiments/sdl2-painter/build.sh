#\!/bin/bash
set -e
cd "$(dirname "$0")"
pkg_flags=$(pkg-config --cflags --libs freetype2)
gcc -shared -fPIC -O2 ft_helper.c -o ft_helper.so $pkg_flags
echo "Built: ft_helper.so"
