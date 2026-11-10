/* Display-only projection. Original reports, field observations and logs are retained. */
(function(S){'use strict';
S.UnitDisplay={project(unit,report){const u={...unit},f=u.fieldObservation;u.received=!!(report&&!report.fieldOnly);if(u.status==='moving'||(u.status==='unresponded'&&!f&&!u.fieldStatus))u.status='blank';return u;}};
})(window.SAFEHOME);
