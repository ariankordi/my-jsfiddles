### update the thing

1. get latest fiddles and commits
```
wget -qO- https://jsfiddle.net/api/user/arian_/demo/list.json\?limit=50 > jsfiddle-arian_-list.json
```
2. download the fiddles
(todo you will also have to `ln -s fiddle-wget/jsfiddle.net/arian_/ fiddle-downloads`)
```
bash download-fiddles-from-list.sh jsfiddle-arian_-list.json arian_
```
3.
* you will have to add id to name mapping
* add the entry to `gallery-metadata.csv`
* make sure you have the correct history
    - extract from safari: `sh safari-first-visit-to-csv.sh /Volumes/working_ssd/safari\ history\ old/2026-03-10/History.db jsfiddle.net/arian_ history-asof-2026-03-10.csv`
    - potentially merge: `bun merge-history.ts history-asof-2025-03.csv history-asof-2026-01.csv history-asof-2026-03-10.csv history-2024-to-2026.csv`

4. re-commit
this is the first ts tool so make sure to install packages
```
bun commit-fiddles.ts test-repo history-2024-to-2026.csv arian_ fiddle-names.csv
```

if you need to make the test-repo fresh:
```
mkdir test-repo && cd test-repo/ && git init . && cd ../
```

5. redo screenshots and gallery
```
bun generate-screenshots.ts && bun generate-gallery.ts
```

6. uhh
