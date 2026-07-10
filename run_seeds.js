const sql = require('mssql');

async function main() {
  try {
    const expPool = await sql.connect({
      server: '185.187.235.253', port: 1433, database: 'ATLX_EXPLORER_APP',
      user: 'sa', password: 'Olokum681228$',
      options: { encrypt: false, trustServerCertificate: true }
    });
    console.log('Conectado ATLX_EXPLORER_APP');

    const antojadosPool = await sql.connect({
      server: '185.187.235.253', port: 1433, database: 'ATLX_ANTOJADOS_APP',
      user: 'sa', password: 'Olokum681228$',
      options: { encrypt: false, trustServerCertificate: true }
    });
    console.log('Conectado ATLX_ANTOJADOS_APP');

    // Seed desde biz_posts
    console.log('\n--- Seed desde biz_posts ---');
    const bizPosts = await antojadosPool.request()
      .query("SELECT biz_post_id, publisher_user_id, channel, sponsored, created_at FROM antojados_core.biz_posts WHERE status = 'active'");
    console.log('Total biz_posts activos:', bizPosts.recordset.length);

    let seededBiz = 0;
    for (const bp of bizPosts.recordset) {
      const pubId = 'pub-sp-' + bp.biz_post_id;
      const exists = await expPool.request()
        .input('pid', sql.VarChar(50), pubId)
        .query('SELECT 1 FROM explorer_core.publications WHERE publication_id = @pid');
      if (exists.recordset.length > 0) continue;

      await expPool.request()
        .input('publication_id', sql.VarChar(50), pubId)
        .input('sponsor_id', sql.VarChar(50), bp.publisher_user_id)
        .input('external_post_id', sql.VarChar(255), bp.biz_post_id)
        .input('channel', sql.VarChar(20), bp.channel)
        .input('feed_type', sql.VarChar(20), bp.sponsored ? 'PUBLICITY' : 'GENERAL')
        .input('mode', sql.VarChar(10), 'sponsor')
        .input('published_at', sql.DateTime2(3), bp.created_at)
        .query("INSERT INTO explorer_core.publications (publication_id, sponsor_id, external_post_id, channel, feed_type, mode, status, published_at) VALUES (@publication_id, @sponsor_id, @external_post_id, @channel, @feed_type, @mode, 'published', @published_at)");
      seededBiz++;
    }
    console.log('Insertados en explorer_core.publications desde biz_posts:', seededBiz);

    // Seed desde soc_posts
    console.log('\n--- Seed desde soc_posts ---');
    const socPosts = await antojadosPool.request()
      .query("SELECT post_id, user_id, feed_type, published_at FROM antojados_core.soc_posts WHERE post_status = 'active'");
    console.log('Total soc_posts activos:', socPosts.recordset.length);

    const channelMap = {
      pachanga: 'pachanga',
      desma: 'en_el_desma',
      neta: 'que_pex',
      momentos: 'que_pex'
    };

    let seededSoc = 0;
    for (const sp of socPosts.recordset) {
      const pubId = 'pub-sc-' + sp.post_id;
      const exists = await expPool.request()
        .input('pid', sql.VarChar(50), pubId)
        .query('SELECT 1 FROM explorer_core.publications WHERE publication_id = @pid');
      if (exists.recordset.length > 0) continue;

      const channel = channelMap[sp.feed_type] || sp.feed_type;

      await expPool.request()
        .input('publication_id', sql.VarChar(50), pubId)
        .input('user_id', sql.VarChar(50), sp.user_id)
        .input('external_post_id', sql.VarChar(255), sp.post_id)
        .input('channel', sql.VarChar(20), channel)
        .input('feed_type', sql.VarChar(20), 'USER')
        .input('mode', sql.VarChar(10), 'social')
        .input('published_at', sql.DateTime2(3), sp.published_at)
        .query("INSERT INTO explorer_core.publications (publication_id, user_id, external_post_id, channel, feed_type, mode, status, published_at) VALUES (@publication_id, @user_id, @external_post_id, @channel, @feed_type, @mode, 'published', @published_at)");
      seededSoc++;
    }
    console.log('Insertados en explorer_core.publications desde soc_posts:', seededSoc);

    await expPool.close();
    await antojadosPool.close();
    console.log('\n✅ Seeds completados exitosamente!');
    console.log(`   Biz posts seed: ${seededBiz}`);
    console.log(`   Soc posts seed: ${seededSoc}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
