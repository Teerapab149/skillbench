# Build the final report: course template -> reference.docx -> book.docx -> layout in Word -> final .docx + PDF for review
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
if ($LASTEXITCODE -ne 0) { throw 'patch-styles failed' }
if (Test-Path "$b\reference.docx") { Remove-Item "$b\reference.docx" }
[IO.Compression.ZipFile]::CreateFromDirectory($w, "$b\reference.docx")
Remove-Item "$b\figures\*.png" -ErrorAction SilentlyContinue
node "$root\scripts\report\build-book.mjs"
if ($LASTEXITCODE -ne 0) { throw 'build-book failed' }

# The final file name is Thai; build-book writes it to a UTF-8 text file (PowerShell 5.1 reads scripts as ANSI)
$final = (Get-Content "$b\final-path.txt" -Encoding UTF8 -Raw).Trim()

# The headings we need are all near the start: scan only the first paragraphs (COM per-paragraph access is slow)
function FindStyle($doc, $style) {
  $want = $style.NameLocal
  $n = [Math]::Min(600, $doc.Paragraphs.Count)
  for ($i = 1; $i -le $n; $i++) {
    $p = $doc.Paragraphs.Item($i)
    if ($p.Style.NameLocal -eq $want) { return $p }
  }
  throw "style not found in first $n paragraphs: $want"
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $d = $word.Documents.Open("$b\book.docx")
  $h1 = $d.Styles.Item(-2)            # wdStyleHeading1
  $fh = $d.Styles.Item('Front Heading')

  # Sections: cover (no number) | front matter (Thai letters) | body (1, 2, 3), page number top right
  $p = FindStyle $d $h1; $r = $p.Range; $r.Collapse(1); $r.InsertBreak(2)
  $p = FindStyle $d $fh; $r = $p.Range; $r.Collapse(1); $r.InsertBreak(2)
  (FindStyle $d $fh).Format.PageBreakBefore = $false
  (FindStyle $d $h1).Format.PageBreakBefore = $false

  $d.PageSetup.OddAndEvenPagesHeaderFooter = $false
  foreach ($s in $d.Sections) {
    $s.PageSetup.DifferentFirstPageHeaderFooter = $false
    foreach ($t in 1, 2, 3) {
      if ($s.Index -gt 1) { $s.Headers.Item($t).LinkToPrevious = $false; $s.Footers.Item($t).LinkToPrevious = $false }
      $s.Headers.Item($t).Range.Text = ''
      $s.Footers.Item($t).Range.Text = ''
    }
  }
  foreach ($i in 2, 3) {
    $pn = $d.Sections.Item($i).Headers.Item(1).PageNumbers
    $pn.RestartNumberingAtSection = $true
    $pn.StartingNumber = 1
    if ($i -eq 2) { $pn.NumberStyle = 53 } else { $pn.NumberStyle = 0 }   # 53 = Thai letters (ก ข ค)
    $pn.Add(2, $true) | Out-Null                                           # 2 = right
  }

  # Tables: size columns to content, then stretch the whole table to the text width
  foreach ($tb in $d.Tables) {
    $tb.AllowAutoFit = $true
    $tb.AutoFitBehavior(1)
    $tb.PreferredWidthType = 2      # percent
    $tb.PreferredWidth = 100
    $tb.Rows.Item(1).HeadingFormat = -1   # repeat header row when a table spans pages
  }
  # Main TOC: replace the plain TOC field with Word's own "Automatic Table 1" building block
  # (content control with the Update Table button), Thai version if installed, levels 1-2
  $word.Templates.LoadBuildingBlocks()
  $bb = $null
  foreach ($lcid in '\1054\', '\1033\') {
    foreach ($tp in $word.Templates) {
      if ($bb -eq $null -and $tp.FullName -like "*$lcid*Built-In Building Blocks*") {
        for ($i = 1; $i -le $tp.BuildingBlockEntries.Count; $i++) {
          $e = $tp.BuildingBlockEntries.Item($i)
          if ($e.Type.Index -eq 14) { $bb = $e; break }    # first table-of-contents entry = Automatic Table 1
        }
      }
    }
  }
  if ($bb -ne $null) {
    $old = $d.TablesOfContents.Item(1)
    $pos = $old.Range.Start
    $head = $d.Range($pos - 1, $pos - 1).Paragraphs.Item(1)   # the "สารบัญ" front heading just before the field
    $old.Delete()
    $hs = $head.Range.Start
    $head.Range.Delete() | Out-Null
    $bb.Insert($d.Range($hs, $hs), $true) | Out-Null
    # The block's own heading says "Contents"/"เนื้อหา"; rename it to "สารบัญ" (built from code points: script is ANSI)
    $title = [string]::new([char[]](0x0E2A, 0x0E32, 0x0E23, 0x0E1A, 0x0E31, 0x0E0D))
    $hr = $d.Range($hs, $hs).Paragraphs.Item(1).Range
    $hr.MoveEnd(1, -1) | Out-Null
    $hr.Text = $title
    $toc = $d.TablesOfContents.Item(1)
    $toc.UpperHeadingLevel = 1
    $toc.LowerHeadingLevel = 2
  }
  foreach ($t in $d.TablesOfContents) { $t.Update() }
  $d.Fields.Update() | Out-Null
  $pages = $d.ComputeStatistics(2)
  # If the final file is open in Word, save a timestamped copy instead
  try { $d.SaveAs2($final, 16) } catch { $final = $final -replace '\.docx$', ('-' + (Get-Date -Format 'HHmm') + '.docx'); $d.SaveAs2($final, 16) }
  $d.SaveAs2("$b\book.pdf", 17)
  $d.Close(0)
  "pages $pages"
  "saved $final"
} finally {
  $word.Quit()
}
