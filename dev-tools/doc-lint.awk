# Portable awk: document syntax/readiness, TODO uniqueness and human-check registry.
function fail(code,file,line,message) { print "ERROR " file ":" line " [" code "] " message; errors++ }
function inspect(file,    line,number,fence,clean,token,name,value,id,status,version,n,a,rest,target) {
  number=0; fence=""
  while ((getline line < file)>0) {
    number++; sub(/\r$/, "", line)
    if (line ~ /^[ ]*```/ || line ~ /^[ ]*~~~/) {
      clean=line; sub(/^[ ]*/,"",clean); token=substr(clean,1,3)
      if (!fence) fence=token; else if (fence==token) fence=""
      continue
    }
    if (fence) continue
    clean=line; gsub(/`[^`]*`/,"",clean)
    rest=clean
    while (match(rest,/\[[^]]+\]\([^)]+\)/)) {
      target=substr(rest,RSTART,RLENGTH); sub(/^\[[^]]+\]\(/,"",target); sub(/\)$/,"",target)
      print file "\t" number "\t" target >> links
      rest=substr(rest,RSTART+RLENGTH)
    }
    if (file=="docs/human-checks.md" && line ~ /^\|[ ]*`[A-Z0-9_]+`/) {
      id=line; sub(/^\|[ ]*`/,"",id); sub(/`.*/,"",id); registered[id]=number
    }
    if (!match(clean,/<!--[ ]*[A-Z0-9_]+:/)) continue
    token=substr(clean,RSTART); name=token; sub(/^<!--[ ]*/,"",name); sub(/:.*/,"",name)
    if (name=="DOC_META") {
      if (token !~ /^<!-- DOC_META: status=(draft|review|ready) version=[1-9][0-9]* -->$/) { fail("MALFORMED_MARKER",file,number,"invalid DOC_META"); continue }
      n=split(token,a," "); status=a[3]; sub(/^status=/,"",status); version=a[4]; sub(/^version=/,"",version)
      meta[file]++; states[file]=status; versions[file]=version
      if (meta[file]>1) fail("MALFORMED_MARKER",file,number,"duplicate DOC_META")
    } else if (name=="DOC_TODO" || name=="HUMAN_CHECK") {
      if (token !~ /^<!-- (DOC_TODO|HUMAN_CHECK): [A-Z0-9_]+ — .+\. -->$/) { fail("MALFORMED_MARKER",file,number,"invalid " name); continue }
      split(token,a," "); id=a[3]
      if (name=="DOC_TODO") {
        if (id in todo_ids) fail("DUPLICATE_TODO",file,number,id " already appears in " todo_ids[id])
        todo_ids[id]=file; open_todos[file]++; total_todos++
      } else { human[id]=file ":" number }
      if (todos) print "INFO " name " " file ":" number " " id
    } else if (name=="DOC_SYNC") {
      if (token !~ /^<!-- DOC_SYNC: .+\. -->$/) fail("MALFORMED_MARKER",file,number,"invalid DOC_SYNC")
    } else fail("UNKNOWN_MARKER",file,number,name)
  }
  close(file)
  if (file !~ /^\.scratch\//) {
    if (!meta[file]) fail("MISSING_DOC_META",file,1,"durable document needs DOC_META")
    if (states[file]=="ready" && open_todos[file]) fail("READY_HAS_TODO",file,1,"ready documents cannot contain DOC_TODO")
    print "INFO " file " status=" states[file] " version=" versions[file] " todos=" (open_todos[file]+0)
  }
}
BEGIN {
  while ((getline file < list)>0) inspect(file)
  close(list); close(links)
  for (id in human) if (!(id in registered)) fail("UNTRACKED_HUMAN_CHECK",human[id],1,id " missing from registry")
  for (id in registered) if (!(id in human)) fail("UNTRACKED_HUMAN_CHECK","docs/human-checks.md",registered[id],id " has no marker")
  human_count=0; for (id in human) human_count++
  print "INFO Open decisions: " (total_todos+0) "; human checks: " human_count
  exit (errors ? 1 : 0)
}
