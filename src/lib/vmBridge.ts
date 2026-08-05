/** Helpers to wire nested eval + vision into StageVM without full rewrite each time */

import type { StageVM } from '../engine/vm';
import { detectFromWebcam, topLabel } from '../engine/vision';

export function attachVisionToVm(vm: StageVM) {
  // Monkey-patch via public AI caller pattern: store last vision labels on project vars
  const original = (vm as unknown as { visionScan?: () => Promise<string> }).visionScan;
  void original;
  (vm as unknown as { runVisionScan: () => Promise<string[]> }).runVisionScan = async () => {
    const dets = await detectFromWebcam();
    const labels = dets.map((d) => d.class);
    const proj = vm.getProject();
    proj.variables['vision'] = topLabel(dets);
    proj.lists['objects'] = labels;
    return labels;
  };
}
