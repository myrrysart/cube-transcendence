# Input is produced from Git blobs by doc-check.sh, never executed as shell code.
BEGIN { FS=OFS="\t" }
function error(code, path, message) { print "ERROR [" code "] " path ": " message; errors++ }
function positive(value) { return value ~ /^[1-9][0-9]*$/ && length(value) <= 9 }
$1=="A" { if ($2 in blob) error("DUPLICATE_FILE",$2,"duplicate index entry"); blob[$2]=$3; mode[$2]=$4 }
$1=="B" { oldblob[$2]=$3; oldmode[$2]=$4 }
$1=="D" { doc[$2]=$3; status[$2]=$4 }
$1=="E" { olddoc[$2]=$3 }
$1=="R" { renamed[$2]=$3 }
$1=="P" { previous[$2]=$3; previousHash[$2]=$4; previousRefs[$2]=$5 }
$1=="C" {
  if (NF!=5) error("REGISTRY_FORMAT",$2,"expected four tab-separated columns")
  if ($2 in revision) error("DUPLICATE_MAPPING",$2,"one row per file is required")
  revision[$2]=$3; hash[$2]=$4; refs[$2]=$5
}
END {
  for (path in doc) {
    if (!positive(doc[path])) error("CONTRACT_VERSION",path,"expected a positive document revision")
    if ((path in olddoc) && blob[path]!=oldblob[path] && doc[path]<=olddoc[path])
      error("CONTRACT_VERSION",path,"changed contract needs a DOC_META version greater than " olddoc[path])
    if ((path in olddoc) && doc[path]<olddoc[path]) error("CONTRACT_VERSION",path,"contract revision cannot go backwards")
  }
  for (path in revision) {
    if (!(path in blob)) {
      if (operation!="record") error("ORPHAN_MAPPING",path,"remove the mapping for this deleted/excluded file")
      continue
    }
    if (!positive(revision[path]) && !(operation=="record" && revision[path]=="0"))
      error("FILE_VERSION",path,"file revision must be a positive integer")
    if (refs[path]=="-") {
      if (!(path in doc)) error("CONTRACT_REQUIRED",path,"only contract documents may use '-'")
    } else {
      count=split(refs[path],parts,","); updated=""; seen="|"
      if (!count) error("CONTRACT_REQUIRED",path,"declare at least one srcs/md contract")
      for (i=1;i<=count;i++) {
        ref=parts[i]; n=split(ref,pair,"@"); contract=pair[1]
        if (n!=2 || !positive(pair[2]) || !(contract in doc)) {
          error("CONTRACT_REFERENCE",path,"invalid or missing contract: " ref); continue
        }
        if (index(seen,"|" contract "|")) error("DUPLICATE_REFERENCE",path,contract)
        seen=seen contract "|"
        if (operation!="record" && pair[2]!=doc[contract]) error("STALE_CONTRACT",path,ref " must reference @" doc[contract])
        updated=updated (i>1 ? "," : "") contract "@" doc[contract]
      }
      if (operation=="record") refs[path]=updated
    }
    before=path
    if (!(path in previous) && (path in renamed)) before=renamed[path]
    changed=(path!=before || blob[path]!=oldblob[before] || mode[path]!=oldmode[before])
    if (operation=="record") {
      revision[path]=(before in previous) ? previous[before]+(changed ? 1 : 0) : 1
      hash[path]=blob[path]
    } else {
      if (hash[path]!=blob[path]) error("CONTENT_DRIFT",path,"record the reviewed staged content hash")
      if (before in previous) {
        if (changed && revision[path]<=previous[before]) error("FILE_VERSION",path,"changed file needs a revision greater than " previous[before])
        if (!changed && revision[path]!=previous[before]) error("FILE_VERSION",path,"unchanged file must keep revision " previous[before])
      } else if (revision[path]!=1) error("FILE_VERSION",path,"newly registered file must start at revision 1")
    }
  }
  for (path in blob) {
    if (!(path in revision)) error("UNMAPPED_FILE",path,"add a registry row: path<TAB>0<TAB>-<TAB>srcs/md/contract.md@version")
  }
  if (errors) exit 1
  if (operation=="record") for (path in blob) print path,revision[path],hash[path],refs[path] > output
  file_count=0; for (path in blob) file_count++
  print "INFO File registry: " file_count " covered files; Git retains previous versions and deleted paths."
}
