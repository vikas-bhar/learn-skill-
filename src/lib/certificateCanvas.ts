import { SkillCertificate } from '../types/learning';

export function formatReadableDate(iso: string): string {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function sanitizeTextForCanvas(text: string): string {
  return text
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[*^$#@]/g, '')
    .trim();
}

export function buildCertificateFilename(topic: string): string {
  const slug =
    topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'skill';
  return `skillpath-certificate-${slug}.png`;
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export function downloadCertificatePng(cert: SkillCertificate): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#0B1020';
  ctx.fillRect(0, 0, 1600, 1100);

  const gradTop = ctx.createRadialGradient(260, 180, 20, 260, 180, 520);
  gradTop.addColorStop(0, 'rgba(109, 93, 251, 0.22)');
  gradTop.addColorStop(1, 'rgba(11, 16, 32, 0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, 1600, 1100);

  const gradBottom = ctx.createRadialGradient(1340, 920, 20, 1340, 920, 520);
  gradBottom.addColorStop(0, 'rgba(77, 141, 255, 0.20)');
  gradBottom.addColorStop(1, 'rgba(11, 16, 32, 0)');
  ctx.fillStyle = gradBottom;
  ctx.fillRect(0, 0, 1600, 1100);

  ctx.fillStyle = '#11182B';
  ctx.fillRect(64, 64, 1472, 972);

  ctx.strokeStyle = '#6D5DFB';
  ctx.lineWidth = 3;
  ctx.strokeRect(64, 64, 1472, 972);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(86, 86, 1428, 928);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#A78BFA';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SKILLPATH AI  -  ADAPTIVE MASTERY CREDENTIAL', 800, 175);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 54px "Sora", sans-serif';
  ctx.fillText('Certificate of Mastery', 800, 255);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(460, 295);
  ctx.lineTo(1140, 295);
  ctx.stroke();

  ctx.fillStyle = '#AAB4C8';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('This certifies that', 800, 365);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 60px "Sora", sans-serif';
  ctx.fillText(sanitizeTextForCanvas(cert.learnerName), 800, 448);

  ctx.fillStyle = '#AAB4C8';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'has completed all modules, capstone projects, and Final AI Exam in',
    800,
    520
  );

  ctx.fillStyle = '#4D8DFF';
  ctx.font = '700 42px "Sora", sans-serif';
  ctx.fillText(sanitizeTextForCanvas(cert.topic), 800, 588);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
  drawWrappedText(
    ctx,
    sanitizeTextForCanvas(cert.strengthSummary),
    800,
    662,
    1080,
    34
  );

  const stats = [
    { label: 'Final AI Exam', value: `${cert.finalScore}%` },
    {
      label: 'Projects Verified',
      value: `${cert.projectsCompleted ?? 2} Completed`,
    },
    { label: 'Profile Score', value: `${cert.totalScore} pts` },
    { label: 'Issued Date', value: sanitizeTextForCanvas(formatReadableDate(cert.issuedAtIso)) },
  ];

  const boxWidth = 280;
  const gap = 36;
  const totalRowW = stats.length * boxWidth + (stats.length - 1) * gap;
  const startX = (1600 - totalRowW) / 2;

  stats.forEach((item, idx) => {
    const bx = startX + idx * (boxWidth + gap);
    ctx.fillStyle = '#17213A';
    ctx.fillRect(bx, 760, boxWidth, 114);
    ctx.strokeStyle = '#273554';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, 760, boxWidth, 114);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#73809B';
    ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(item.label, bx + boxWidth / 2, 798);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 24px "Sora", sans-serif';
    ctx.fillText(item.value, bx + boxWidth / 2, 845);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#73809B';
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText(
    `Credential ID ${sanitizeTextForCanvas(cert.certificateId)}  -  Verified by SkillPath AI`,
    800,
    955
  );

  const link = document.createElement('a');
  link.download = buildCertificateFilename(cert.topic);
  link.href = canvas.toDataURL('image/png');
  link.click();
  return true;
}
