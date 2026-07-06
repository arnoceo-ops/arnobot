import { NextRequest, NextResponse } from 'next/server'
import { notifyCronFailure } from '@/lib/cron-notify'

const REPO = 'arnoceo-ops/arnobot'
const BRANCH = 'master'

function githubHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function getFile(token: string, path: string): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: githubHeaders(token),
  })
  if (!res.ok) return null
  const data = await res.json()
  const content = Buffer.from(data.content, 'base64').toString('utf8')
  return { content, sha: data.sha }
}

async function putFile(token: string, path: string, content: string, sha: string, message: string) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch: BRANCH,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${err}`)
  }
}

function replaceAutoSection(doc: string, tag: string, newContent: string): string {
  const open = `<!-- AUTO:${tag} -->`
  const close = `<!-- /AUTO:${tag} -->`
  const regex = new RegExp(`${open}[\\s\\S]*?${close}`, 'g')
  return doc.replace(regex, `${open}\n${newContent}\n${close}`)
}

function extractModelsTable(claudeMd: string): string {
  const start = claudeMd.indexOf('## Model-inventaris')
  if (start === -1) return ''
  const section = claudeMd.slice(start)
  const tableStart = section.indexOf('| Route |')
  if (tableStart === -1) return ''
  const afterTable = section.slice(tableStart)
  // Tabel eindigt bij eerste lege regel na de tabelrijen
  const tableEnd = afterTable.search(/\n\s*\n[^|]/)
  const raw = tableEnd === -1 ? afterTable : afterTable.slice(0, tableEnd)
  return raw.trim()
}

function buildVersionsTable(pkgJson: string): string {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try { pkg = JSON.parse(pkgJson) } catch { return '' }

  const KEY_PACKAGES = [
    'next', 'react', '@anthropic-ai/sdk', '@clerk/nextjs', '@supabase/supabase-js',
    'resend', '@upstash/ratelimit', '@upstash/redis', 'sanity', 'voyageai',
    '@react-pdf/renderer', 'jspdf', 'typescript',
  ]
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  const rows = KEY_PACKAGES
    .filter(k => all[k])
    .map(k => `| ${k} | ${all[k]} |`)
    .join('\n')
  return `| Package | Versie |\n|---|---|\n${rows}`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN niet geconfigureerd' }, { status: 500 })
  }

  try {
    const now = new Date().toISOString().split('T')[0]
    const commitMessage = `docs: automatische update overdrachts­documenten ${now}`
    const updated: string[] = []

    // Haal benodigde bronbestanden op
    const [claudeMdFile, pkgFile, techFile, bizFile] = await Promise.all([
      getFile(token, 'CLAUDE.md'),
      getFile(token, 'package.json'),
      getFile(token, 'docs/TECHNICAL_HANDOVER.md'),
      getFile(token, 'docs/BUSINESS_HANDOVER.md'),
    ])

    // --- TECHNICAL_HANDOVER.md ---
    if (techFile) {
      let doc = techFile.content

      // Timestamp
      doc = replaceAutoSection(doc, 'UPDATED', `Laatste automatische update: ${now}`)

      // Model-inventaris uit CLAUDE.md
      if (claudeMdFile) {
        const modelsTable = extractModelsTable(claudeMdFile.content)
        if (modelsTable) {
          doc = replaceAutoSection(doc, 'MODELS', modelsTable)
        }
      }

      // Package-versies uit package.json
      if (pkgFile) {
        const versionsTable = buildVersionsTable(pkgFile.content)
        if (versionsTable) {
          doc = replaceAutoSection(doc, 'VERSIONS', versionsTable)
        }
      }

      if (doc !== techFile.content) {
        await putFile(token, 'docs/TECHNICAL_HANDOVER.md', doc, techFile.sha, commitMessage)
        updated.push('TECHNICAL_HANDOVER.md')
      }
    }

    // --- BUSINESS_HANDOVER.md ---
    if (bizFile) {
      const doc = replaceAutoSection(bizFile.content, 'UPDATED', `Laatste automatische update: ${now}`)
      if (doc !== bizFile.content) {
        await putFile(token, 'docs/BUSINESS_HANDOVER.md', doc, bizFile.sha, commitMessage)
        updated.push('BUSINESS_HANDOVER.md')
      }
    }

    // Admin-notificatie e-mail
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && updated.length > 0) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ArnoBot <info@arno.bot>',
          to: 'arno@arno.bot',
          subject: `[ArnoBot] Overdrachts­documenten bijgewerkt — ${now}`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#111827;color:#f1f5f9;padding:40px;max-width:560px;margin:0 auto;">
              <p style="color:#f59e0b;font-size:12px;letter-spacing:4px;margin-bottom:24px;">ARNOBOT ADMIN</p>
              <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:16px;">
                De overdrachts­documenten zijn bijgewerkt op ${now}.
              </p>
              <ul style="font-size:14px;color:#9ca3af;line-height:2;padding-left:20px;">
                ${updated.map(f => `<li>${f}</li>`).join('')}
              </ul>
              <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-top:24px;">
                Wat automatisch bijgewerkt is: modellen­inventaris, package­versies, datumstempel.<br><br>
                Wat jij handmatig moet bijhouden: kosten, accounttoegang, changelog, [ARNO]-secties in BUSINESS_HANDOVER.md.
              </p>
              <a href="https://github.com/${REPO}/tree/${BRANCH}/docs" style="display:inline-block;margin-top:24px;background:#f59e0b;color:#111827;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 24px;text-decoration:none;border-radius:999px;">BEKIJK DOCS OP GITHUB</a>
              <p style="font-size:11px;color:#374151;margin-top:40px;">© ARNOBOT</p>
            </div>
          `,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, updated, date: now })
  } catch (err) {
    await notifyCronFailure('update-handover', err)
    return NextResponse.json({ error: 'cron_error' }, { status: 500 })
  }
}
