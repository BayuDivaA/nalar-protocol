# NALAR Protocol: Extension Design System

Status: diterapkan pada presentation layer extension dan diverifikasi pada kedua tema. Dokumen ini menggantikan arah desain extension sebelumnya.
Scope: popup browser, dialog intent, loading analisis, hasil dan penjelasan, evidence, detail teknis, serta keadaan error.
Arah: minimalism, trust & authority.
Prinsip: Understand → Verify → Decide.

Dokumen ini adalah sumber utama untuk presentasi extension, termasuk kedua tema dan semua dialog transaksi.
Landing page menjadi referensi identitas; tema dan layout website yang sudah ada tetap berlaku.

## 1. Keputusan desain utama

- Seluruh permukaan extension mendukung light dan dark yang lembut. Dark memakai slate, bukan hitam pekat atau navy cosmic.
- Tema cosmic dihapus. Tidak ada bintang, orbit, ruang angkasa, pola galaksi, grid dekoratif, atau cahaya neon.
- Theme switcher berbentuk icon dengan accessible label. Reuse preferensi `nalarTheme` pada storage existing; popup dan overlay memakai pilihan yang sama, terlepas dari tema DApp.
- Tampilan modern dibentuk oleh proporsi, keterbacaan, ketepatan alignment, dan interaksi yang cepat.
- Trust & authority dibentuk oleh alasan yang jelas, sumber bukti, dan status yang jujur. Bukan badge kepercayaan, janji aman, atau angka dekoratif.
- Popup adalah pengaturan ringkas. Dialog transaksi adalah tempat membaca intent, progres yang diketahui, dan hasil pemeriksaan.
- Arah desain tidak mengubah keputusan, risk score, intersepsi, API, atau sumber penjelasan yang sudah ada.

Design Read: alat pemeriksaan dan forensik transaksi bagi pengguna Web3 awam. Verdict dominan, intent dan tindakan aktual menjadi lapisan kedua; bukti disajikan sebagai catatan bersumber, bukan kartu dashboard atau wallet.
Dial: ENERGY 1 / RHYTHM 2 / MOTION 1. Gerak terbatas pada perubahan status dan umpan balik tindakan.

## 2. Hubungan dengan landing page

Gunakan identitas landing page sebagai acuan: aksen biru kehijauan, tipografi sans-serif, logo asli, dan garis tipis. Light memakai abu sangat muda dan putih; dark memakai slate lembut dengan teks off-white, lebih terang daripada latar gelap landing.

| Elemen bersama | Penerapan pada extension |
|---|---|
| Identitas Nalar | Logo yang sudah tersedia, dengan bentuk dan proporsi asli |
| Warna | Keluarga warna landing; aksen disesuaikan dan diuji untuk masing-masing tema |
| Tipografi | Sans-serif yang sama dengan situs; monospace hanya untuk nilai teknis |
| Hierarki | Satu informasi utama per layar, detail pendukung di bawahnya |
| Permukaan | Kontras latar dan whitespace, bukan tumpukan floating card |
| Motion | Transisi pendek yang menjelaskan tindakan atau perubahan status |

Extension tidak menyalin hero website, ukuran headline landing, diagram arsitektur, atau navigasi website.
Tidak diperlukan aset baru. Pilih aset logo berdasarkan warna yang terlihat, bukan nama file: isi gelap untuk light dan isi terang untuk dark. Pertahankan icon toolbar yang sudah tersedia.

## 3. Sistem warna: soft light dan soft dark

Token dipetakan ke variabel popup dan `--nalar-ui-*` existing pada overlay. Jangan menerapkan tema extension ke komponen DApp.

### Light

| Token semantik | Nilai | Fungsi |
|---|---|---|
| `--bg` | `#F4F7F8` | Latar extension dan bidang sekunder |
| `--surface` | `#FFFFFF` | Permukaan utama popup, dialog, dan input |
| `--surface-raised` | `#E9EEF1` | Hover atau pemilihan yang ringan |
| `--text-primary` | `#0B1419` | Judul, keputusan, dan isi utama |
| `--text-secondary` | `#40515B` | Penjelasan pendukung |
| `--text-muted` | `#586B75` | Label, waktu pembacaan, dan metadata |
| `--border` | `#D5E0E5` | Divider dekoratif |
| `--border-strong` | `#AEBFC8` | Pemisah yang perlu sedikit lebih tegas |
| `--control-border` | `#718692` | Batas input atau kontrol yang harus terlihat |
| `--accent` | `#126F91` | Tindakan utama, link, ACTIVE, progres, dan fokus |
| `--accent-hover` | `#0C5774` | Hover tombol utama |
| `--accent-soft` | `#EAF3F7` | Pemilihan ringan, bukan latar seluruh section |
| `--allow` | `#2B7657` | Indikator ALLOW |
| `--review` | `#8A6418` | Indikator REVIEW |
| `--block` | `#B54343` | Indikator BLOCK |
| `--on-accent` | `#FFFFFF` | Teks tombol berwarna aksen |

Aksen mempertahankan keluarga warna landing page. Warna lebih gelap dipilih karena label extension lebih kecil: aksen memiliki kontras minimal 4,84:1 pada tiga permukaan utama, amber minimal 4,59:1.

### Dark

| Token semantik | Nilai | Fungsi |
|---|---|---|
| `--bg` | `#202830` | Latar slate lembut, bukan hitam |
| `--surface` | `#26313A` | Permukaan dialog dan input |
| `--surface-raised` | `#303D47` | Hover dan pemilihan |
| `--text-primary` | `#EDF2F5` | Judul dan isi utama |
| `--text-secondary` | `#C3CDD4` | Penjelasan pendukung |
| `--text-muted` | `#A5B2BC` | Label dan metadata |
| `--border` | `#43515C` | Divider lembut |
| `--border-strong` | `#61717D` | Pemisah tegas |
| `--control-border` | `#7C8D99` | Batas kontrol |
| `--accent` | `#94CCDC` | Link, ACTIVE, progres, fokus, dan tombol |
| `--accent-hover` | `#B5DFE9` | Hover tombol utama |
| `--accent-soft` | `#2B414B` | Pilihan ringan |
| `--allow` | `#9BC8B0` | Indikator ALLOW |
| `--review` | `#E2C58C` | Indikator REVIEW |
| `--block` | `#EDADAD` | Indikator BLOCK |
| `--on-accent` | `#202830` | Teks gelap di atas tombol aksen terang |

Kontras kedua tema diuji terpisah. Dark bukan inversi otomatis light. Preferensi tersimpan dipakai terlebih dahulu; tanpa preferensi, ikuti light/dark sistem.

Aturan warna:

- Teks biasa harus mencapai 4,5:1; teks besar dan indikator kontrol minimal 3:1.
- Divider dekoratif boleh lebih lembut. Batas kontrol memakai `--control-border`, bukan divider dekoratif.
- Warna semantic hanya pada label keputusan, icon, dan penanda kecil. Isi penjelasan tetap netral.
- ACTIVE memakai aksen; PAUSED memakai neutral. Mainnet dan Testnet memiliki treatment yang setara.
- ANALYSIS UNAVAILABLE adalah status ketersediaan pemeriksaan, bukan keputusan ALLOW, REVIEW, atau BLOCK.
- Disabled control tetap terbaca. Jangan menurunkan opacity seluruh section hingga teks kehilangan kontras.
- Tidak ada automatic theme inversion, gradient, glow, atau glassmorphism pada extension. Latar dark tetap slate lembut.

Hubungkan nilai primitive ke token semantik di atas, lalu gunakan token tersebut untuk komponen. Reuse token dan mekanisme styling yang sudah ada; tidak perlu membuat sistem token atau dependency baru hanya untuk mengikuti dokumen ini.

## 4. Typography dan keterbacaan

Typeface utama mengikuti landing page saat ini:
`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Tidak perlu menambahkan font untuk mengubah tampilan. Logo Nalar menggunakan aset, bukan ketikan dengan letter-spacing sebagai pengganti logo.

Typeface teknis:
`"SF Mono", "Cascadia Code", "Fira Code", ui-monospace, monospace`.

| Peran | Ukuran / line-height | Weight |
|---|---|---|
| Judul keputusan pada overlay | 32 / 36 px; 28 / 32 px pada layar sempit | 650 |
| Judul dialog atau status popup | 20 / 26 px | 600 |
| Judul section | 14 / 20 px | 600 |
| Penjelasan utama | 15 / 24 px | 400 |
| Label dan isi kontrol | 14 / 20 px | 400 atau 500 |
| Metadata | 12 / 18 px | 400 |
| Nilai teknis | 12 / 18 px | 400, monospace |

- Isi penjelasan rata kiri, memakai paragraf pendek. Hindari center alignment pada penjelasan.
- Uppercase hanya untuk label status singkat seperti ACTIVE atau BLOCK. Heading biasa memakai sentence case.
- Jangan memakai monospace untuk alasan, dampak, atau instruksi pengguna.
- Ukuran teks tidak diperkecil untuk memaksakan semua informasi muat.
- Nilai teknis boleh disingkat dengan full value yang dapat diakses. Alasan keamanan tidak boleh dipotong dengan ellipsis.
- Setiap paragraf memiliki satu gagasan. Gunakan daftar hanya untuk beberapa temuan yang memang terpisah.

## 5. Spacing, permukaan, dan batas section

Spacing scale: 4, 8, 12, 16, 24, 32 px.

- Padding popup: 16 px. Padding dialog: 24 px, menjadi 16 px pada viewport sempit.
- Jarak label ke kontrol: 8 px. Jarak isi yang terkait: 8 atau 12 px.
- Jarak antarseksi: 24 px, dipisahkan divider 1 px bila membantu pembacaan.
- Judul section diikuti isi tanpa bingkai tambahan.
- Border digunakan pada batas dialog, input, dropdown terbuka, dan divider penting.
- Radius: 6 px untuk tombol, 8 px untuk input/menu, 12 px untuk dialog.
- Jangan membungkus setiap alasan atau bukti dalam kartu terpisah.
- Shadow hanya untuk menandai dialog di atas DApp atau dropdown yang terbuka. Tidak ada shadow pada tiap section.
- Backdrop overlay berupa scrim netral untuk memisahkan DApp dan dialog. Tidak memakai blur dekoratif.

Pemisah mengikuti makna: pengaturan, keputusan, penjelasan, bukti, dan tindakan. Hindari border berlapis pada section yang sudah berada dalam dialog.

## 6. Popup browser

Popup mengatur proteksi, jaringan, dan intent untuk situs aktif. Popup tidak menampilkan keputusan transaksi yang belum diperiksa atau menyalin hasil overlay lama.

Urutan:

1. Logo Nalar, icon pilihan tema, dan kontrol ACTIVE / PAUSED.
2. Network selector dan status koneksi yang relevan.
3. Status kesiapan proteksi, satu judul dan satu kalimat.
4. Intent untuk situs aktif.
5. Save intent, Clear, dan feedback penyimpanan.

Header tidak memiliki navbar. Theme toggle memakai icon sun/moon dengan nama tindakan yang jelas, tanpa label panjang. Status proteksi terlihat sebagai kontrol dengan label, bukan hanya dot.

Ukuran:

- Target lebar 380 px; tetap nyaman pada 320, 360, dan 400 px.
- Tinggi mengikuti isi. Target keadaan normal maksimal sekitar 560 px.
- Keadaan normal diusahakan muat tanpa scrollbar melalui copy yang singkat dan layout yang efisien.
- Pada ruang popup hingga 650 px, spacing vertikal dipadatkan ke 8–12 px dan textarea menjadi tiga baris (84 px). Ukuran teks dan target kontrol tidak diperkecil.
- Pada ruang browser yang lebih pendek, izinkan satu area scroll vertikal yang dapat diakses. Jangan memotong pesan error atau menyembunyikan scrollbar untuk menutupi overflow.
- Tidak ada horizontal scrolling.

Intent pada popup menggunakan field yang sama secara visual dengan dialog intent. Placeholder singkat, label tetap terlihat, dan tombol Save intent tidak mengambil ukuran CTA website.
Pesan berhasil disimpan muncul dekat tombol sebagai feedback singkat; jangan menambah banner besar yang menggeser seluruh layout.

## 7. Dialog intent

Tujuan: pengguna menyebut tindakan yang ingin dilakukan sebelum pemeriksaan berjalan.

Urutan:

1. Logo dan judul singkat.
2. Situs asal dan jaringan dari konteks request yang sedang aktif.
3. Label “What do you want to do?” dan input intent.
4. Satu helper text bila diperlukan.
5. Tindakan sesuai flow yang sudah ada.

Input:

- Textarea lebar penuh, tinggi awal sekitar 96 px atau tiga baris isi.
- Label berada di luar input dan tidak hilang saat mengetik.
- Maksimal satu contoh singkat. Contoh tidak menjadi nilai default atau intent pengguna.
- Nama native asset pada contoh mengikuti network yang sudah tervalidasi; jangan memakai token demo atau alamat tetap sebagai data transaksi.
- Intent panjang boleh bertambah tinggi sampai batas yang wajar; setelah itu field dapat scroll secara vertikal.
- Enter tetap membuat baris baru. Jangan mengubahnya menjadi persetujuan transaksi.
- Situs asal yang panjang disingkat secara visual dengan nama lengkap yang tetap dapat diakses.

Validasi ditempatkan dekat field. Jika intent belum cukup jelas menurut hasil sistem, tampilkan ketidakpastian dari data yang ada; desain tidak boleh menyatakan MATCH dengan menebak maksud pengguna.

Helper privasi singkat: intent disimpan per situs dan dikirim bersama data transaksi untuk pemeriksaan. Gunakan kontrol Clear yang sudah ada untuk menghapusnya.

## 8. Loading: mengikuti status yang diketahui

Loading harus menjelaskan bahwa pemeriksaan sedang berlangsung dan request belum diteruskan ke wallet apabila keadaan itu memang dikonfirmasi oleh flow.

`showAnalysisOverlay()` membaca event progres dari request security-check yang sama: backend → background → bridge → overlay. Event terikat pada request ID dan chain; tahap hanya selesai setelah operasi backend selesai. Checklist berbasis timer tidak digunakan.

### Bila hanya status keseluruhan yang tersedia

Gunakan:

- Judul “Checking transaction”.
- Satu keterangan singkat tentang pemeriksaan yang sedang ditunggu.
- Situs dan jaringan dari request aktif.
- Satu progress rail indeterminate yang tenang.
- Kontrol pembatalan hanya bila memang tersedia pada flow yang sudah ada.

Jangan menampilkan simulasi “Passed”, checklist selesai, nomor langkah, atau persentase. Jangan membuat daftar fase tampak aktif bergantian tanpa event dari sistem.
Ini adalah fallback untuk deployment yang masih mengembalikan JSON tanpa progres per tahap. UI tidak menebak tahap yang sedang dikerjakan.

### Bila progres per tahap memang tersedia

Tahap ditampilkan dari status analisis nyata yang terikat pada request aktif.

| Status tahap | Presentasi |
|---|---|
| Pending | Label terbaca dan penanda kosong |
| Running | Label utama, aksen kecil, gerak indikator selama tahap berlangsung |
| Completed | Check dan teks netral, hanya setelah konfirmasi selesai |
| Unavailable / failed | Teks yang menjelaskan data tidak tersedia atau proses gagal |
| Skipped | “Not needed for this request”, hanya bila sistem menyatakan tahap dilewati |

Nama tahap merupakan vocabulary UI, bukan hasil pemeriksaan. Vocabulary boleh tetap, tetapi tahap yang tampil, status, urutan aktual, dan penyelesaiannya mengikuti data.
Checklist mencakup intent, decode, simulation, effects, investigasi MCP, state on-chain, pemeriksaan kontrak, keputusan dan penjelasan. Label statis bukan hasil: statusnya mengikuti event nyata. Address yang sedang diperiksa ditampilkan dari event backend. Bila proses berhenti, tahap berikutnya tetap Waiting; data yang tidak tersedia tidak diberi check. Pada viewport pendek, body dialog dapat scroll secara vertikal tanpa overflow horizontal.

### Aturan yang berlaku pada kedua mode

- Tidak ada timer yang menaikkan progress, menandai check, atau mengganti tahap.
- Tidak ada angka persen tanpa denominator dan progres yang benar-benar dilaporkan.
- Efek scanner, typing AI, terminal, atau nama tool yang berkedip tidak digunakan.
- Progress rail boleh bergerak dengan opacity/transform selama operasi masih pending. Loop ini menunjukkan kegiatan yang belum selesai, bukan kemajuan.
- Saat result, failure, timeout, atau cancel tiba, hentikan animasi dan tampilkan status yang sesuai.
- Result langsung ditampilkan saat tersedia; jangan menahannya demi menyelesaikan animasi.
- Request ID, chain, dan transaksi yang berubah tidak boleh memakai indikator selesai dari pemeriksaan sebelumnya.
- Timeout tidak menjadi keputusan aman. Tindakan tetap mengikuti error handling yang sudah ada.
- Pada reduced motion, rail menjadi statis dan status teks tetap berubah.

## 9. Hasil pemeriksaan dan penjelasan

Hierarki hasil:

1. Verdict: decision, judul dominan, level risiko dan skor yang benar-benar tersedia.
2. Intent vs transaction: permintaan pengguna dan tindakan aktual, dengan status comparison existing.
3. Why this verdict: alasan utama dari penjelasan existing, langsung setelah comparison.
4. Affected assets & permissions: token allowance, NFT operator, swap atau mint dari effects existing, bila tersedia.
5. What this means, bila isi yang berbeda dan relevan tersedia.
6. Security evidence: catatan temuan bersumber, terlipat secara default.
7. Technical details, terlipat secara default.
8. Tindakan sesuai keputusan, terlihat jelas dan tidak mengubah flow.

Decision berasal dari security engine. AI menjelaskan hasil; animasi, warna, atau copy UI tidak mengubah decision.
Tandai teks penjelasan `[AI]` hanya ketika `explanation.meta.generator` menyatakan `AI` dan teks yang ditampilkan benar-benar berasal dari penjelasan itu. Alasan deterministik pengganti dan findings engine tidak mendapat label AI. Label tidak berarti verdict dibuat oleh AI.

| Data keputusan | Judul UI | Visual |
|---|---|---|
| ALLOW | Ready to continue | Label ALLOW dan indikator hijau kecil |
| REVIEW | Review required | Label REVIEW dan indikator amber kecil |
| BLOCK | Transaction blocked | Label BLOCK dan indikator merah kecil |
| Belum ada hasil | Checking transaction atau keadaan idle yang tepat | Tidak menampilkan badge keputusan |
| Hasil tidak tersedia | Checks unavailable | Penjelasan kegagalan dan tindakan pemulihan yang tersedia |

ALLOW tidak dipresentasikan sebagai jaminan transaksi aman. Simulasi yang berhasil tidak membuktikan seluruh hasil saat transaksi ditambang.
Verdict menjadi elemen visual terkuat, intent lapisan kedua. Skor dibaca bersama level existing (LOW, MEDIUM, HIGH, CRITICAL); UI tidak menghitung threshold baru. UNKNOWN memakai neutral, bukan success. Tidak ada gauge atau animasi angka. Tanpa skor, tampilkan “Score unavailable”, bukan nol.

### Alasan utama

Heading: “Why this verdict”.

- Tampilkan alasan terpenting dari hasil analisis yang sedang aktif.
- Alasan utama memakai bobot tegas; dampak tambahan dipisahkan dengan label “Impact”. Teks sumber tetap utuh, bukan ringkasan baru dari UI.
- Heading dan divider netral yang jelas membatasi section; tidak perlu memberi bingkai pada setiap bagian.
- Target ringkasan satu sampai tiga kalimat; alasan lengkap tetap bisa dibaca.
- Untuk explanation panjang, pakai paragraf yang rapi atau disclosure yang jelas. Jangan memotong kalimat atau menyembunyikan syarat yang mengubah arti.
- Jangan menambahkan paragraf umum yang hanya mengulang label BLOCK atau REVIEW.
- Bila explanation AI tidak tersedia, tampilkan alasan faktual yang memang tersedia beserta status keterbatasannya.

### Your request vs actual transaction

Dua kolom setara pada layar yang cukup lebar, ditumpuk pada layar sempit. Label dan isi harus mudah dipasangkan.
Tampilkan tindakan, asset, amount, recipient, atau permission yang benar-benar tersedia dan relevan.

MATCH, MISMATCH, dan UNCERTAIN mengikuti hasil comparison yang sudah ada. Tidak ada asumsi “matches” hanya karena request berhasil didekode.
Perbedaan ditulis sebagai teks yang jelas, dengan icon pendukung bila perlu; tidak hanya bergantung pada warna.

### What this means

- Terjemahkan dampak dari penjelasan existing ke layout yang nyaman dibaca.
- Bila data hanya berupa teks bebas, pertahankan teks dan paragrafnya. Jangan menciptakan detail terstruktur atau kemungkinan kerugian dari asumsi UI.
- Section dihilangkan bila hanya mengulang alasan dan tidak memiliki informasi tambahan.
- Bedakan konfigurasi yang terbaca dari perilaku yang terbukti. Nilai konfigurasi pajak tidak menjadi kerugian yang pasti.
- Hindari kolom chat, avatar AI, bubble percakapan, atau ketikan kata per kata untuk hasil analisis.

## 10. Security evidence dan detail teknis

Security evidence memakai normalized findings yang sudah tersedia, ditampilkan sebagai daftar faktual dengan:

- Nama temuan.
- Nilai atau penjelasan singkat.
- Sumber yang benar: intent, simulation, on-chain, atau sumber lain yang memang dilaporkan.
- Waktu atau block pembacaan jika tersedia.
- Keterangan unavailable atau uncertain saat relevan.

Gunakan ledger: kategori bukti, nama temuan, nilai, penjelasan dan sumber existing. Bedakan Simulation, Contract analysis, Address history, Token approval dan On-chain evidence hanya bila source/code existing mendukung kategori itu. Tidak adanya kategori tidak berarti pemeriksaan kategori itu berhasil. Detail source seperti ABI, ONCHAIN, SIMULATION tetap dipertahankan; kategori visual tidak menambahkan fakta keamanan.
Kelompokkan laporan kontrak berdasarkan address yang dianalisis, dengan role dari effects transaksi aktif (asset, spender/operator, input/output atau swap path). Findings transaksi keseluruhan berada pada kelompok terpisah. Laporan tanpa finding tetap menunjukkan batasnya: tidak ada finding yang dikembalikan bukan jaminan aman. Address mengikuti explorer milik chain request tersebut.

Assets dan permission memakai efek request aktif: token, spender/operator, asset input/output, kontrak mint dan recipient. Jangan menebak symbol, decimals, besaran allowance atau cakupan transfer yang tidak dikembalikan sistem. Nilai base-unit, calldata dan selector berada di detail teknis.
Untuk request dengan banyak effects, tampilkan dua entri pertama dan disclosure dengan jumlah entri sisanya. Semua entri tetap tersedia; batch panjang tidak boleh mendorong alasan utama jauh ke bawah tanpa penanda.

Security evidence terlipat secara default, sementara alasan utama tetap terlihat di atasnya.
Tidak ada raw MCP response, raw JSON, daftar transactionHashes, dump gas, atau respons tool di bagian ini.
BNB MCP tidak otomatis diberi label “Connected” hanya karena pernah digunakan.

Technical details terlipat secara default dan memakai label-value sederhana. Tampilkan hanya field yang tersedia: chain, Chain ID, kontrak, spender, recipient, function, selector, simulation, finding code, risk score, serta status MCP.
Array besar tidak tampil secara default. Data debug, jika dibutuhkan, hanya tersedia pada developer view yang sudah diotorisasi.

Jika sumber memberi klaim yang bertentangan, presentation mengikuti mapping authoritative existing dan menandai data yang belum pasti. UI tidak boleh menyatakan address EOA ketika hasil authoritative menyebut kode kontrak ada. Dokumen ini tidak menetapkan algoritma resolusi baru.

Alamat dan tx hash:

- Singkat pada tampilan utama; full value tersedia melalui tooltip yang dapat diakses, accessible label, atau technical details.
- Address/tx hash valid dapat dibuka di explorer chain milik request yang diperiksa.
- Result Mainnet tetap memakai explorer Mainnet, walaupun network selector kemudian berubah.
- Pada konteks chain yang tidak valid, tampilkan nilai tanpa link. Jangan memakai explorer default sembarang.
- Hover menambahkan underline; tidak ada glow atau pembesaran.

## 11. Network dan status proteksi

Network, ACTIVE / PAUSED, dan decision adalah tiga status terpisah.

| Network | Chain ID | Asset | Explorer |
|---|---|---|---|
| BNB Testnet | 97 | tBNB | https://testnet.bscscan.com |
| BNB Mainnet | 56 | BNB | https://bscscan.com |

Network selector menampilkan nama dan Chain ID secara jelas. Dropdown memakai token surface sesuai tema, item yang cukup tinggi, serta check pada pilihan yang telah dikonfirmasi.
Status switch pending atau gagal ditampilkan dari state existing; pilihan baru tidak tampak committed sebelum proses existing berhasil.

Reuse select atau dropdown accessible yang sudah dipakai proyek. Jangan membuat komponen dropdown baru bila styling dan mekanisme existing sudah mencukupi.
Pilihan Mainnet tidak memakai icon warning, warna danger, atau gaya yang berbeda dari Testnet.

ACTIVE / PAUSED:

- Tombol selalu memiliki teks status dan accessible label yang menjelaskan tindakan.
- ACTIVE memakai aksen. PAUSED memakai neutral dan tidak terlihat seperti error.
- Perubahan tampil setelah state existing terkonfirmasi.
- PAUSED → ACTIVE boleh memiliki satu pulse kecil, lalu stabil.
- ACTIVE → PAUSED menurunkan penekanan visual tanpa blinking.
- PAUSED tidak boleh tetap memberi kesan transaksi sedang diperiksa.

## 12. Error dan pemulihan

Satu tempat menampilkan error yang relevan. Hindari duplikasi banner, bingkai, dan pesan yang sama di beberapa section.

| Keadaan existing | Judul singkat | Isi dan tindakan |
|---|---|---|
| RPC / provider gagal | Network connection failed | Network yang gagal, keterangan singkat, Retry / pilihan network bila tersedia |
| Switch gagal | Could not switch network | Network sebelumnya tetap aktif; gunakan tindakan existing |
| Unsupported chain | Network not supported | Sebut dukungan BNB Testnet/Mainnet dan tindakan switch yang tersedia |
| Backend / MCP menghalangi analisis | Checks unavailable | Pemeriksaan belum selesai; Retry / Cancel sesuai flow |
| Analysis timeout | Analysis timed out | Hasil belum tersedia; Retry / Cancel sesuai flow |
| Context belum tervalidasi | Network unavailable | Jangan menampilkan status ready, hasil, atau explorer yang diasumsikan |

Isi maksimal satu sampai dua kalimat. Jangan mengklaim semua data MCP gagal bila yang unavailable hanya satu sumber.
Status “transaction not sent” hanya tampil bila flow mengonfirmasi bahwa request ditahan.
Kegagalan network atau analisis tidak dipresentasikan sebagai ALLOW.

Footer memakai tindakan yang sudah didukung:

- ALLOW: tindakan Continue ke wallet dan Cancel sesuai flow.
- REVIEW: Review & Continue hanya bila engine dan flow mengizinkannya, beserta Cancel.
- BLOCK: Close atau tindakan penolakan yang sudah ada; tidak menambahkan override.
- Failure: pemulihan yang benar-benar tersedia; tidak menambahkan bypass.

Tombol utama memakai aksen dengan `--on-accent`: putih pada light, slate gelap pada dark. Makna blok tetap ada pada label keputusan, bukan seluruh footer merah.
Tidak ada auto-continue atau countdown yang menghasilkan persetujuan.

## 13. Motion

Prinsip: animate state changes.

| Interaksi | Gerak | Durasi |
|---|---|---|
| Popup dibuka | Opacity dan translateY maksimal 4 px | 150 ms |
| Dialog masuk | Opacity dan translateY maksimal 6 px | 220 ms |
| Dialog keluar | Opacity | 100–150 ms |
| Loading → result/error | Crossfade ringan; posisi isi utama tetap | 150–220 ms |
| Dropdown dibuka | Opacity dan translateY maksimal 4 px | 150 ms |
| Pilihan network terkonfirmasi | Opacity label dan highlight lembut | 150 ms |
| Active/Pause | Opacity dan transform indikator; satu pulse saat resume | 150–220 ms |
| Accordion | Rotate chevron dan opacity isi | 150 ms |
| Tombol ditekan | Scale maksimal 0,98 | 100 ms |

Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.

- Gunakan mekanisme motion existing. Tidak ada kebutuhan animation library tambahan.
- Animasi hanya opacity/transform; hindari animasi width, height, top, left, filter, atau box-shadow.
- Accordion berubah layout secara normal; jangan mengukur dan menggerakkan tinggi isi panjang setiap frame.
- Tidak ada bounce, parallax, floating, entrance stagger panjang, atau number counting.
- Status dan akses keyboard tidak menunggu animasi selesai.
- Jangan mengganti loading dengan hasil sementara untuk mengisi transisi.
- Hentikan animasi ketika overlay ditutup atau request berakhir.

Reduced motion menghilangkan pulse dan transform; status tetap berubah secara jelas dengan teks dan opacity singkat atau langsung.

## 14. Responsivitas dan accessibility

| Permukaan | Lebar acuan | Perilaku saat ruang sempit |
|---|---|---|
| Popup | 380 px, diuji 320/360/400 px | Isi membungkus, kontrol tidak mengecil di bawah target tap |
| Dialog intent/loading | Maksimal 480 px | Margin viewport 16 px, padding isi 16 px |
| Dialog hasil | Maksimal 620 px | Comparison ditumpuk; bukti dan detail tetap dapat dibuka |

- Overlay menyesuaikan tinggi viewport dan zoom, dengan maksimum sekitar viewport dikurangi margin 32 px.
- Penjelasan panjang memakai satu area scroll vertikal. Header ringkas dan tindakan tetap dapat diakses tanpa menutupi isi.
- Tidak ada nested scrolling pada section evidence dan technical details.
- Pada layar pendek, seluruh dialog boleh scroll bila footer tetap tidak menutupi teks atau fokus.
- Input dan technical values memiliki min-width yang memungkinkan layout mengecil; isi panjang membungkus atau disingkat sesuai jenis data.
- Target interaksi minimal 44 × 44 px. Tidak ada horizontal overflow pada 320 px atau zoom 200%.
- Semua tombol, link, dropdown, dan disclosure dapat dijangkau dengan Tab dan dipakai lewat keyboard.
- Dialog memiliki nama accessible, fokus masuk yang tepat, serta pengembalian fokus saat ditutup.
- Escape mengikuti tindakan cancel/close yang sudah didukung. Menutup tampilan tidak berarti melanjutkan transaksi.
- Focus ring memakai aksen 2 px dengan offset 2 px; tidak dihapus.
- Gunakan teks untuk MATCH/UNCERTAIN, ACTIVE/PAUSED, dan keputusan. Icon atau warna hanya pendukung.
- Loading memakai pengumuman status yang tidak berulang tiap frame. Error dan result diumumkan ketika status berubah.
- Bahasa penjelasan existing tetap dipakai. Terjemahan atau perubahan bahasa tidak boleh mengubah fakta maupun keputusan.

## 15. Aturan copy dan integritas data

- Copy singkat, spesifik pada request aktif, dan mudah dipahami.
- Gunakan “permission” dengan penjelasan awam ketika istilah tersebut relevan; raw finding code tetap berada di detail teknis.
- Situs, chain, asset, amount, address, risk score, dan sumber harus berasal dari data existing.
- Empty state tidak menggunakan skor contoh atau transaksi demo.
- Jangan menampilkan klaim “protected”, “verified”, atau “connected” saat konteks belum valid.
- Contoh copy dalam dokumen adalah vocabulary desain. Nilai dan klaim transaksi tetap harus diambil dari hasil actual.
- Alasan keamanan tidak boleh direkayasa ulang untuk mendapatkan paragraf yang lebih pendek.
- Simulasi berhasil, ABI tersedia, atau MCP merespons adalah fakta terpisah; masing-masing bukan jaminan aman.

## 16. Kriteria implementasi

Implementasi hanya mengerjakan presentasi berdasarkan source data dan flow yang sudah ada. Panduan UI/UX Pro Max dipakai untuk kontras, target interaksi, disclosure, fokus, dan motion; rekomendasi layout marketing atau font baru tidak menggantikan identitas Nalar.

Checklist acceptance:

- [x] Popup, intent, loading, result, evidence, technical details, dan error memakai pilihan soft light/dark yang sama.
- [x] Tidak ada tema cosmic; pilihan tema tersimpan dan tidak memengaruhi tema DApp.
- [x] Logo existing tetap utuh dan terbaca pada kedua tema.
- [x] Network, proteksi, dan decision terpisah serta mudah dipahami.
- [x] Batas section jelas tanpa tumpukan kartu atau border.
- [x] Intent field proporsional; aksi utama dan helper tidak berebut perhatian.
- [x] Loading tanpa progres rinci memakai indeterminate state yang jujur.
- [x] Tidak ada fake completion, persentase, risk score, metadata, atau hasil sementara.
- [x] Alasan, comparison, dampak, bukti, dan detail teknis memiliki urutan yang jelas.
- [x] Penjelasan memakai area scroll yang dapat diakses, termasuk pada viewport pendek.
- [x] Explorer sesuai chain result dan tidak mengasumsikan konteks yang tidak valid.
- [x] Error memakai tindakan existing dan tidak berubah menjadi keputusan aman.
- [x] Motion pendek, mengikuti perubahan state, dan mendukung reduced motion.
- [x] Keyboard, fokus, kontras, serta lebar 320/360/400 px diverifikasi.
- [ ] Zoom browser 200% dengan wallet nyata diverifikasi secara manual.
- [x] Flow transaksi, backend, MCP, risk calculation, API, dan sumber AI explanation tetap mengikuti implementasi existing.

Verifikasi: `npm run check`, `npm run build:motion`, 19 test presentation dan 8 test network/background. Pemeriksaan browser pemisah section dan keterbacaan alasan mencakup kedua tema pada 320/360/400 px, disclosure, explorer, dan reduced motion. `tests/popup-layout.mjs` dengan action popup Chromium asli serta state intent/loading/error telah diverifikasi pada tahap sebelumnya. Uji ini tidak menggantikan pengujian transaksi live dengan MetaMask/Rabby.

North star: pengguna melihat verdict, tindakan aktual dan alasan utama lebih dulu, lalu permission/asset dan bukti tanpa dipaksa membaca detail teknis.
