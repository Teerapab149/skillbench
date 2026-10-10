# Build the final report: course template -> reference.docx -> book.docx -> refresh TOC in Word -> PDF for review
# Usage: powershell -File scripts/report/build.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Resolve-Path "$PSScriptRoot\..\.."
$b = "$root\report\final\build"
New-Item -ItemType Directory -Force $b | Out-Null
$w = "$b\ref"
if (Test-Path $w) { Remove-Item -Recurse -Force $w }
[IO.Compression.ZipFile]::ExtractToDirectory("$root\report template\technical_report_template.docx", $w)
node "$root\scripts\report\patch-styles.mjs" "$w\word\styles.xml"
if (Test-Path "$b\reference.docx") { Remove-Item "$b\reference.docx" }
[IO.Compression.ZipFile]::CreateFromDirectory($w, "$b\reference.docx")
Remove-Item "$b\figures\*.png" -ErrorAction SilentlyContinue
node "$root\scripts\report\build-book.mjs"
# The output file name is Thai; look it up instead of hard-coding (PowerShell 5.1 reads UTF-8 scripts as ANSI)
$docx = (Get-ChildItem "$root\report\final" -Filter '*-477-401.docx' | Select-Object -First 1).FullName
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$d = $word.Documents.Open($docx)
foreach ($tb in $d.Tables) { $tb.AllowAutoFit = $true; $tb.AutoFitBehavior(1); $tb.AutoFitBehavior(2) }
foreach ($t in $d.TablesOfContents) { $t.Update() }
$d.Fields.Update() | Out-Null
$d.Save()
$pages = $d.ComputeStatistics(2)
$d.SaveAs2("$b\book.pdf", 17)
$d.Close()
$word.Quit()
"pages $pages"
