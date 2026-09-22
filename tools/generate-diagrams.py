from pathlib import Path
from html import escape

OUT = Path(__file__).resolve().parents[1] / 'docs' / 'diagramas'
OUT.mkdir(parents=True, exist_ok=True)

def svg_start(width, height, title):
    return [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<style>
.title{{font:700 28px Arial,sans-serif;fill:#102f57}} .subtitle{{font:14px Arial,sans-serif;fill:#52657a}}
.head{{font:700 15px Arial,sans-serif;fill:white}} .body{{font:13px Arial,sans-serif;fill:#172b44}}
.small{{font:12px Arial,sans-serif;fill:#52657a}} .edge{{stroke:#6f88a8;stroke-width:2;fill:none;marker-end:url(#arrow)}}
.label{{font:11px Arial,sans-serif;fill:#37516f}} .actor{{font:700 14px Arial,sans-serif;fill:#173f73}}
</style><defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0,0 L10,3.5 L0,7 z" fill="#6f88a8"/></marker></defs>
<rect width="100%" height="100%" fill="#f8fbff"/><text x="45" y="45" class="title">{escape(title)}</text><text x="45" y="70" class="subtitle">InventIC IEP San Rafael</text>''']

def box(parts, x, y, w, heading, fields, color='#173f73'):
    h=38+len(fields)*22+12
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="white" stroke="#b9c9da"/>')
    parts.append(f'<path d="M{x+8},{y} h{w-16} a8,8 0 0 1 8,8 v30 h{-w} v-30 a8,8 0 0 1 8,-8" fill="{color}"/>')
    parts.append(f'<text x="{x+12}" y="{y+24}" class="head">{escape(heading)}</text>')
    for i, field in enumerate(fields): parts.append(f'<text x="{x+12}" y="{y+58+i*22}" class="body">{escape(field)}</text>')
    return (x, y, w, h)

def edge(parts, a, b, label, vertical=False):
    ax,ay,aw,ah=a; bx,by,bw,bh=b
    if vertical:
        x1=ax+aw/2; y1=ay+ah; x2=bx+bw/2; y2=by
        parts.append(f'<path d="M{x1},{y1} L{x2},{y2}" class="edge"/>')
        parts.append(f'<text x="{(x1+x2)/2+5}" y="{(y1+y2)/2-4}" class="label">{escape(label)}</text>')
    else:
        x1=ax+aw; y1=ay+ah/2; x2=bx; y2=by+bh/2
        parts.append(f'<path d="M{x1},{y1} L{x2},{y2}" class="edge"/>')
        parts.append(f'<text x="{(x1+x2)/2-20}" y="{(y1+y2)/2-5}" class="label">{escape(label)}</text>')

def erd():
    p=svg_start(1700,1130,'Diagrama entidad relación de la base de datos')
    roles=box(p,45,120,220,'roles',['PK id','nombre'])
    users=box(p,355,120,250,'usuarios',['PK id','UK email','FK rol_id','FK sede_id'])
    sites=box(p,695,120,220,'sedes',['PK id','UK nombre','direccion'])
    locations=box(p,1010,120,250,'ubicaciones',['PK id','UK nombre','FK sede_id','tipo'])
    types=box(p,1355,120,235,'tipos_equipo',['PK id','nombre'])
    equipment=box(p,680,390,285,'equipos',['PK id','UK codigo','FK tipo_id','FK ubicacion_id','FK responsable_id','estado'],'#286090')
    reportStatus=box(p,1050,390,240,'estados_reporte',['PK id','nombre'])
    reports=box(p,350,650,270,'reportes',['PK id','FK equipo_id','FK usuario_id','FK estado_id','fecha_reporte'],'#286090')
    maintenance=box(p,730,650,285,'mantenimientos',['PK id','UK FK reporte_id','FK tecnico_id','fecha_inicio','fecha_fin'],'#286090')
    loans=box(p,1100,650,285,'prestamos',['PK id','FK equipo_id','FK usuario_id','FK registrado_por','fecha_prestamo','devuelto_en'],'#286090')
    activity=box(p,470,925,270,'actividad',['PK id','FK usuario_id','FK equipo_id','descripcion','fecha'],'#607d9b')
    config=box(p,1080,925,255,'configuracion',['PK clave','valor'],'#607d9b')
    edge(p,roles,users,'1 a N'); edge(p,users,sites,'N a 1'); edge(p,sites,locations,'1 a N'); edge(p,locations,types,'N a 1')
    edge(p,locations,equipment,'1 a N',True); edge(p,types,equipment,'1 a N',True); edge(p,users,equipment,'responsable',True)
    edge(p,equipment,reports,'1 a N',True); edge(p,reports,maintenance,'1 a 0..1'); edge(p,reportStatus,reports,'estado',True)
    edge(p,reports,activity,'registra',True); edge(p,maintenance,activity,'audita',True); edge(p,equipment,loans,'1 a N',True); edge(p,loans,config,'reglas',True)
    p.append('<text x="45" y="1090" class="small">PK: clave primaria · FK: clave foránea · UK: campo único. La tabla configuracion es independiente.</text></svg>')
    (OUT/'entidad_relacion_inventic.svg').write_text(''.join(p),encoding='utf-8')

def class_diagram():
    p=svg_start(1550,950,'Diagrama de clases y responsabilidades')
    auth=box(p,55,135,300,'Autenticación',['+ login(email, password)','+ logout()','+ access(rol)','Gestiona sesión y permisos'],'#173f73')
    app=box(p,440,135,300,'Servicios de aplicación',['+ rows(sql, params)','+ execute_sql(sql, params)','+ activity(mensaje, equipo)','+ page_start(titulo)'],'#286090')
    equipment=box(p,825,135,300,'Equipo',['id, codigo, tipo, ubicacion','estado, responsable','+ crear() + editar()','+ consultarDetalle()'],'#286090')
    loan=box(p,1210,135,280,'Prestamo',['equipo, usuario, fechas','+ crear()','+ devolver()','+ validarDisponibilidad()'],'#286090')
    report=box(p,440,495,300,'Reporte',['equipo, usuario, estado','descripcion, fecha','+ registrar()','+ filtrarPeriodo()'],'#173f73')
    maintenance=box(p,825,495,300,'Mantenimiento',['reporte, tecnico','diagnostico, solucion','+ asignar()','+ completar()'],'#173f73')
    repository=box(p,1210,495,280,'Base de datos PDO',['usuarios, equipos','prestamos, reportes','mantenimientos','consultas preparadas'],'#607d9b')
    edge(p,auth,app,'autoriza'); edge(p,app,equipment,'opera'); edge(p,equipment,loan,'disponibilidad'); edge(p,app,report,'registra',True); edge(p,report,maintenance,'origina'); edge(p,loan,repository,'persiste',True); edge(p,maintenance,repository,'persiste',True); edge(p,app,repository,'consulta',True)
    p.append('<text x="55" y="885" class="small">El sistema PHP es procedimental: estas clases representan las entidades y servicios reales para documentar responsabilidades y dependencias.</text></svg>')
    (OUT/'clases_responsabilidades_inventic.svg').write_text(''.join(p),encoding='utf-8')

def use_cases():
    p=svg_start(1550,880,'Diagrama de casos de uso')
    p.append('<rect x="350" y="115" width="1090" height="680" rx="14" fill="white" stroke="#8ca3bd" stroke-width="2"/><text x="380" y="150" class="actor">Sistema InventIC</text>')
    actors=[('Administrador',85,250),('Técnico',85,460),('Docente',85,670)]
    for name,x,y in actors:
        p.append(f'<circle cx="{x+45}" cy="{y}" r="18" fill="#d9e9fb" stroke="#173f73"/><path d="M{x+45},{y+18} v55 M{x+15},{y+42} h60 M{x+45},{y+73} l-28,34 M{x+45},{y+73} l28,34" stroke="#173f73" stroke-width="3" fill="none"/><text x="{x}" y="{y+125}" class="actor">{name}</text>')
    cases=[('Iniciar sesión',520,220),('Consultar panel e inventario',800,220),('Gestionar equipos y ubicaciones',1120,220),('Registrar préstamos y devoluciones',600,450),('Gestionar fallas y mantenimiento',930,450),('Generar reportes y CSV',1220,450),('Actualizar perfil',600,670),('Administrar usuarios y configuración',970,670),('Reportar falla',1270,670)]
    for label,x,y in cases:
        p.append(f'<ellipse cx="{x}" cy="{y}" rx="125" ry="37" fill="#eff5fc" stroke="#286090" stroke-width="2"/><text x="{x}" y="{y+5}" text-anchor="middle" class="body">{escape(label)}</text>')
    links=[(130,250,395,220),(130,250,675,220),(130,250,995,220),(130,250,475,450),(130,250,805,450),(130,250,1095,450),(130,250,475,670),(130,250,845,670),(130,460,395,220),(130,460,675,220),(130,460,995,220),(130,460,475,450),(130,460,805,450),(130,460,1095,450),(130,460,475,670),(130,670,395,220),(130,670,475,670),(130,670,1145,670)]
    for x1,y1,x2,y2 in links: p.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#9aafc5" stroke-width="1.4"/>')
    p.append('<text x="45" y="845" class="small">Administrador: acceso completo. Técnico: inventario, préstamos, ubicaciones, mantenimiento y reportes. Docente: reporta fallas y administra su perfil.</text></svg>')
    (OUT/'casos_uso_inventic.svg').write_text(''.join(p),encoding='utf-8')

erd(); class_diagram(); use_cases()
print(OUT)
