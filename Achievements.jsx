import React, { useMemo } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { computeStats, evaluateBadges } from '../lib/achievements.js';

export default function Achievements() {
  const { data } = useShop();
  const stats = useMemo(() => computeStats(data), [data]);
  const badges = useMemo(() => evaluateBadges(stats), [stats]);
  const earned = badges.filter((b) => b.earned);
  const next = badges.filter((b) => !b.earned).sort((a, b) => (b.value / b.goal) - (a.value / a.goal)).slice(0, 3);

  let recap = 'Record a sale to start your weekly recap.';
  if (stats.thisWeek > 0 || stats.lastWeek > 0) {
    recap = `${stats.thisWeek} piece${stats.thisWeek === 1 ? '' : 's'} sold in the last 7 days`;
    if (stats.lastWeek > 0) {
      const pct = Math.round(((stats.thisWeek - stats.lastWeek) / stats.lastWeek) * 100);
      recap += pct === 0 ? ', same as the week before.' : `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% from the week before.`;
    } else recap += '.';
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title"><Icon name="sparkles" size={17} /> Milestones</div>
        <span className="hint small">{earned.length} of {badges.length} earned</span>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>{recap}{stats.streak >= 2 ? ` You're on a ${stats.streak}-day selling streak.` : ''}</p>
      {earned.length > 0 && (
        <div className="wizard-shared-chips">
          {earned.map((b) => <span className="wizard-shared-chip" key={b.id} title={b.desc}>{b.title}</span>)}
        </div>
      )}
      {next.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="side-section" style={{ padding: '4px 0 6px' }}>Up next</div>
          {next.map((b) => (
            <div key={b.id} style={{ marginBottom: 10 }}>
              <div className="order-name" style={{ fontSize: 13 }}>{b.title} <span className="order-meta">· {b.value}/{b.goal}</span></div>
              <div className="goal-track"><div className="goal-fill" style={{ width: Math.round((b.value / b.goal) * 100) + '%' }} /></div>
              <div className="order-meta">{b.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
