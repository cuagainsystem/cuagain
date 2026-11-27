export type PhaseGroup = 'Essential' | 'Second' | 'Advanced' | 'Before launch';

export type RoadmapPhase = {
  number: number;
  title: string;
  group: PhaseGroup;
  state: 'done' | 'current' | 'upcoming';
};

/** The ten roadmap phases, in build order. Update `state` as each phase is finished. */
export const ROADMAP_PHASES: RoadmapPhase[] = [
  { number: 1, title: 'Foundation and design system', group: 'Essential', state: 'done' },
  { number: 2, title: 'Landing page and authentication', group: 'Essential', state: 'done' },
  { number: 3, title: 'Database, profiles and roles', group: 'Essential', state: 'current' },
  { number: 4, title: 'Reports, search and filters', group: 'Essential', state: 'upcoming' },
  { number: 5, title: 'Claims and item recovery', group: 'Essential', state: 'upcoming' },
  { number: 6, title: 'Chat and notifications', group: 'Second', state: 'upcoming' },
  { number: 7, title: 'Admin dashboard and monitoring', group: 'Second', state: 'upcoming' },
  { number: 8, title: 'Image matching and advanced tools', group: 'Advanced', state: 'upcoming' },
  { number: 9, title: 'Security and quality assurance', group: 'Before launch', state: 'upcoming' },
  { number: 10, title: 'Deployment and handover', group: 'Before launch', state: 'upcoming' },
];
