import type { PathSimulation } from "@/types/domain";

export function buildDecisionEvidence(simulations: PathSimulation[]) {
  const ranking = [...simulations]
    .sort((a, b) => b.readinessScore - a.readinessScore)
    .map((simulation, index) => ({
      rank: index + 1,
      track: simulation.track,
      trackName: simulation.trackName,
      subtrack: simulation.subtrack,
      readinessScore: simulation.readinessScore,
      feasibility: simulation.feasibility,
      majorObstacle: simulation.majorObstacle,
    }));

  const comparison = simulations.map((simulation) => ({
    track: simulation.track,
    trackName: simulation.trackName,
    subtrack: simulation.subtrack,
    totalTimeCost: simulation.totalTimeCost,
    totalMoneyCost: simulation.totalMoneyCost,
    opportunityCost: simulation.opportunityCost,
    conversionValue: simulation.conversionValue,
  }));

  return { ranking, comparison };
}
