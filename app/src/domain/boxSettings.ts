export interface BoxSettings {
  // Keep these keys aligned with the Python dataclass and saved project JSON
  // during the first port so fixture comparisons show behavior changes, not
  // serialization churn. Lengths are millimetres unless a field says otherwise.
  job_name: string;
  box_kind: 'drawer' | 'box';
  size_x: number;
  size_y: number;
  size_z: number;
  material_thickness: number;
  stock_width: number;
  stock_height: number;
  bit_diameter: number;
  finger_width: number;
  fit_clearance_mm: number;
  include_tabs: boolean;
  tab_width: number;
  tab_height: number;
  relief_diameter: number;
  cut_depth_step: number;
  safe_height: number;
  surface_height: number;
  feed_rate: number;
  plunge_rate: number;
  spindle_speed: number;
  layout_gap: number;
}

export const createDefaultBoxSettings = (): BoxSettings => {
  return {
    job_name: 'finger-box',
    box_kind: 'drawer',
    size_x: 160.0,
    size_y: 100.0,
    size_z: 70.0,
    material_thickness: 6.0,
    stock_width: 600.0,
    stock_height: 400.0,
    bit_diameter: 3.175,
    finger_width: 12.0,
    fit_clearance_mm: 0.15,
    include_tabs: true,
    tab_width: 4.0,
    tab_height: 1.5,
    relief_diameter: 3.175,
    cut_depth_step: 1.5,
    safe_height: 5.0,
    surface_height: 0.5,
    feed_rate: 650,
    plunge_rate: 180,
    spindle_speed: 18000,
    layout_gap: 14.0
  };
};

export const finalCutDepth = (settings: Pick<BoxSettings, 'material_thickness'>): number => {
  // Cut slightly past the nominal material thickness so real stock separates
  // cleanly even when the spoilboard or sheet thickness is not perfectly flat.
  return -(settings.material_thickness + 0.35);
};

export const effectiveReliefDiameter = (
  settings: Pick<BoxSettings, 'bit_diameter' | 'relief_diameter'>
): number => {
  if (settings.relief_diameter <= 0.0) {
    return 0.0;
  }
  return Math.max(settings.relief_diameter, settings.bit_diameter);
};
