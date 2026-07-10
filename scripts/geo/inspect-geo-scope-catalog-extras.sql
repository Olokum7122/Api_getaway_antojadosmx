SELECT scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code, status
FROM antojados_core.geo_scope_catalog
WHERE scope_level = 'mexico'
ORDER BY scope_code;

SELECT scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code, status
FROM antojados_core.geo_scope_catalog
WHERE scope_level = 'ciudad'
  AND (
    scope_code NOT LIKE '%[_][0-9]%'
    OR scope_code = 'MX_52'
  )
ORDER BY scope_code;
