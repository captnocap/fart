import React from 'react';
import { Box, Text } from '../../../packages/shared/src';

interface FontSampleProps {
  label: string;
  packName: string;
  fontPath: string;
  sample: string;
  size?: string;
}

function FontSample({ label, packName, fontPath, sample, size }: FontSampleProps) {
  return (
    <Box style={{
      backgroundColor: '#1e293b',
      borderRadius: 8,
      padding: 12,
      gap: 6,
    }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
          {label}
        </Text>
        <Text style={{ color: '#475569', fontSize: 10 }}>
          {`fonts/${packName}/${size ? ` (${size})` : ''}`}
        </Text>
      </Box>
      <Text style={{
        color: '#e2e8f0',
        fontSize: 18,
        fontFamily: fontPath,
      }}>
        {sample}
      </Text>
      <Text style={{ color: '#64748b', fontSize: 10 }}>
        {`fontFamily: "${fontPath}"`}
      </Text>
    </Box>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Box style={{ paddingTop: 8, paddingBottom: 2 }}>
      <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: 'bold' }}>
        {title}
      </Text>
    </Box>
  );
}

export function FontShowcaseStory() {
  return (
    <Box style={{ gap: 8, padding: 16, width: '100%', height: '100%', overflow: 'scroll' }}>
      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold' }}>
        Font Packs
      </Text>
      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
        Bundled Noto Sans fonts. Drop any .ttf into fonts/ and reference with fontFamily.
      </Text>

      {/* Base pack — default when fonts/base/ exists */}
      <SectionHeader title="Base (default)" />

      <FontSample
        label="Latin / Cyrillic / Greek"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="The quick brown fox jumps over the lazy dog"
        size="1 MB"
      />

      <FontSample
        label="Cyrillic (included in base)"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="Съешь ещё этих мягких французских булок"
      />

      <FontSample
        label="Greek (included in base)"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="Θlongest χαλεπα τα καλα"
      />

      <FontSample
        label="Bold"
        packName="base"
        fontPath="fonts/base/NotoSans-Bold.ttf"
        sample="Bold weight for emphasis and headings"
      />

      {/* European layouts */}
      <SectionHeader title="European" />

      <FontSample
        label="French (AZERTY layout in OSK)"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="Les naifs aeuvres couvrent en bref le chapitre"
      />

      <FontSample
        label="German (QWERTZ layout in OSK)"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="Falsches Ueben von Xylophonmusik quaelt jeden"
      />

      <FontSample
        label="Spanish"
        packName="base"
        fontPath="fonts/base/NotoSans-Regular.ttf"
        sample="El veloz murcielago hindu comia feliz cardillo"
      />

      {/* RTL scripts */}
      <SectionHeader title="Right-to-Left" />

      <FontSample
        label="Arabic"
        packName="arabic"
        fontPath="fonts/arabic/NotoSansArabic-Regular.ttf"
        sample="بسم الله الرحمن الرحيم"
        size="492 KB"
      />

      <FontSample
        label="Hebrew"
        packName="hebrew"
        fontPath="fonts/hebrew/NotoSansHebrew-Regular.ttf"
        sample="דג סקרן שט בים מאוכזב ולפתע מצא חברה"
        size="60 KB"
      />

      {/* South Asian */}
      <SectionHeader title="South Asian" />

      <FontSample
        label="Devanagari (Hindi)"
        packName="devanagari"
        fontPath="fonts/devanagari/NotoSansDevanagari-Regular.ttf"
        sample="नमस्ते दुनिया"
        size="464 KB"
      />

      <FontSample
        label="Bengali"
        packName="bengali"
        fontPath="fonts/bengali/NotoSansBengali-Regular.ttf"
        sample="আমি বাংলায় গান গাই"
        size="412 KB"
      />

      <FontSample
        label="Tamil"
        packName="tamil"
        fontPath="fonts/tamil/NotoSansTamil-Regular.ttf"
        sample="வணக்கம் உலகம்"
        size="152 KB"
      />

      <FontSample
        label="Sinhala"
        packName="sinhala"
        fontPath="fonts/sinhala/NotoSansSinhala-Regular.ttf"
        sample="ආයුබෝවන් ලෝකය"
        size="640 KB"
      />

      {/* Southeast Asian */}
      <SectionHeader title="Southeast Asian" />

      <FontSample
        label="Thai"
        packName="thai"
        fontPath="fonts/thai/NotoSansThai-Regular.ttf"
        sample="สวัสดีชาวโลก"
        size="84 KB"
      />

      <FontSample
        label="Khmer"
        packName="khmer"
        fontPath="fonts/khmer/NotoSansKhmer-Regular.ttf"
        sample="សួស្តីពិភពលោក"
        size="228 KB"
      />

      <FontSample
        label="Myanmar"
        packName="myanmar"
        fontPath="fonts/myanmar/NotoSansMyanmar-Regular.ttf"
        sample="မင်္ဂလာပါကမ္ဘာ"
        size="404 KB"
      />

      <FontSample
        label="Lao"
        packName="lao"
        fontPath="fonts/lao/NotoSansLao-Regular.ttf"
        sample="ສະບາຍດີຊາວໂລກ"
        size="68 KB"
      />

      {/* Caucasus / Africa */}
      <SectionHeader title="Caucasus / Africa" />

      <FontSample
        label="Georgian"
        packName="georgian"
        fontPath="fonts/georgian/NotoSansGeorgian-Regular.ttf"
        sample="გამარჯობა მსოფლიო"
        size="112 KB"
      />

      <FontSample
        label="Armenian"
        packName="armenian"
        fontPath="fonts/armenian/NotoSansArmenian-Regular.ttf"
        sample="Բարdelays աdelays"
        size="68 KB"
      />

      <FontSample
        label="Ethiopic"
        packName="ethiopic"
        fontPath="fonts/ethiopic/NotoSansEthiopic-Regular.ttf"
        sample="ሰላም ዓለም"
        size="676 KB"
      />

      {/* CJK */}
      <SectionHeader title="CJK (Chinese / Japanese / Korean)" />

      <FontSample
        label="Simplified Chinese"
        packName="cjk"
        fontPath="fonts/cjk/NotoSansCJK-SC-Regular.ttf"
        sample="你好世界"
        size="16 MB"
      />

      <FontSample
        label="Japanese"
        packName="cjk"
        fontPath="fonts/cjk/NotoSansCJK-JP-Regular.ttf"
        sample="こんにちは世界"
        size="16 MB"
      />

      <FontSample
        label="Korean"
        packName="cjk"
        fontPath="fonts/cjk/NotoSansCJK-KR-Regular.ttf"
        sample="안녕하세요 세계"
        size="16 MB"
      />

      {/* Usage instructions */}
      <SectionHeader title="Usage" />

      <Box style={{
        backgroundColor: '#0f172a',
        borderRadius: 8,
        padding: 12,
        gap: 4,
        borderWidth: 1,
        borderColor: '#1e293b',
      }}>
        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
          Base font auto-detected: if fonts/base/ exists, NotoSans becomes the
          default for all Text without explicit fontFamily. Covers Latin,
          Cyrillic, and Greek.
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
          {'\nFor other scripts, set fontFamily on Text style:'}
        </Text>
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
          {'  fontFamily: "fonts/arabic/NotoSansArabic-Regular.ttf"'}
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
          {'\nAdd any .ttf to your project\'s fonts/ directory.\nLove2D loads any TrueType (.ttf) or OpenType (.otf) font.'}
        </Text>
      </Box>

      {/* Spacer at bottom for scroll */}
      <Box style={{ height: 24 }} />
    </Box>
  );
}
