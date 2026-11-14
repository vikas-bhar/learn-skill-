import { SkillNode, SkillTreeData, StudyPlanDay } from '../types/learning';

export interface RoadmapStats {
  totalCount: number;
  masteredCount: number;
  progressPct: number;
  allModulesMastered: boolean;
  currentFocusNode: SkillNode | null;
}

export function getTierLabel(tier: number): string {
  if (tier === 1) return 'Foundations';
  if (tier === 2) return 'Core Mechanics';
  if (tier === 3) return 'Applied Systems';
  return 'Synthesis';
}

export function getNodeStatusLabel(status: SkillNode['status']): string {
  if (status === 'mastered') return 'Completed';
  if (status === 'ready') return 'Current Focus';
  if (status === 'needs_review') return 'Up Next';
  return 'Future';
}

export function computeRoadmapStats(skillTree: SkillTreeData | null): RoadmapStats {
  const nodes = skillTree?.nodes || [];
  const totalCount = nodes.length;
  const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
  const progressPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const currentFocusNode =
    nodes.find((n) => n.id === skillTree?.recommendedNextId) ||
    nodes.find((n) => n.status === 'ready') ||
    nodes.find((n) => n.status === 'needs_review') ||
    nodes[0] ||
    null;

  return {
    totalCount,
    masteredCount,
    progressPct,
    allModulesMastered: totalCount > 0 && masteredCount === totalCount,
    currentFocusNode,
  };
}

export function buildFallbackStudyPlan(nodes: SkillNode[]): StudyPlanDay[] {
  return nodes.slice(0, 7).map((n, idx) => ({
    day: idx + 1,
    dateLabel: idx === 0 ? 'Day 1 · Today' : `Day ${idx + 1}`,
    moduleId: n.id,
    taskTitle: n.title,
    estimatedMinutes: n.estimatedMinutes,
    motivation: n.whyItMatters || n.summary,
    completed: n.status === 'mastered',
  }));
}
