import type {
  CharacterPortrait,
  CompanionProfile,
  PortraitBankConfig,
  StoryClockState,
} from '../types/ark';

export function normalizeCharacterKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeAgeFromBirthday(
  birthday?: string,
  clock?: StoryClockState,
): string {
  const raw = String(birthday || '').trim();
  if (!raw) return '';

  let birthYear = 0;
  let birthMonth = 0;
  let birthDay = 0;

  const dmy = raw.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  const ymd = !dmy
    ? raw.match(/(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/)
    : null;

  if (dmy) {
    birthDay = Number(dmy[1]);
    birthMonth = Number(dmy[2]);
    birthYear = Number(dmy[3]);
  } else if (ymd) {
    birthYear = Number(ymd[1]);
    birthMonth = Number(ymd[2]);
    birthDay = Number(ymd[3]);
  } else {
    const yearOnly = raw.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearOnly) {
      birthYear = Number(yearOnly[1]);
    }
  }

  if (!birthYear || birthYear < 1850 || birthYear > 2200) return '';

  const now = new Date();
  const hasClockYear =
    typeof clock?.year === 'number' &&
    Number.isFinite(clock.year) &&
    clock.year >= 1900 &&
    clock.year <= 2500;
  const refYear = hasClockYear ? Math.floor(clock!.year) : now.getFullYear();
  const refMonth =
    hasClockYear && typeof clock?.month === 'number' && clock.month >= 1 && clock.month <= 12
      ? Math.floor(clock.month)
      : now.getMonth() + 1;
  const refDay =
    hasClockYear && typeof clock?.day === 'number' && clock.day >= 1 && clock.day <= 31
      ? Math.floor(clock.day)
      : now.getDate();

  let age = refYear - birthYear;
  if (birthMonth >= 1 && birthMonth <= 12) {
    if (refMonth < birthMonth || (refMonth === birthMonth && birthDay >= 1 && refDay < birthDay)) {
      age -= 1;
    }
  }
  if (age < 1 || age > 140) return '';
  return `${age} tuổi`;
}

export function formatAgeBirthdayLabel(age?: string, birthday?: string): string {
  const cleanAge = String(age || '').trim();
  const cleanBirth = String(birthday || '').trim();
  const formattedAge =
    cleanAge && /^\d+$/.test(cleanAge) ? `${cleanAge} tuổi` : cleanAge;
  if (formattedAge && cleanBirth) return `${formattedAge} · Sinh ${cleanBirth}`;
  if (formattedAge) return formattedAge;
  if (cleanBirth) return `Sinh ${cleanBirth}`;
  return '';
}

export interface KnownCelebrityProfile {
  canonicalName: string;
  aliases?: string[];
  role: string;
  birthday?: string;
  fashionStyle?: string;
  appearance: string;
  personality?: string;
  relationships?: string;
  signature?: string;
}

const KNOWN_CELEBRITY_LIST: KnownCelebrityProfile[] = [
  {
    canonicalName: 'Central Cee',
    aliases: ['cench'],
    role: 'Rapper UK',
    birthday: '04/06/1998',
    fashionStyle:
      'Streetwear London hiện đại (Syna World/Trapstar): tracksuit, áo khoác puffer hoặc hoodie rộng, tanktop trắng bên trong, quần cargo, phối dây chuyền bạc, nhẫn và đồng hồ sang trọng.',
    appearance:
      'Nam rapper gốc Anh lai châu Á, vóc dáng gầy cao, tóc cắt buzzcut/fade sát gọn gàng, khuôn mặt sắc nét có râu cằm mảnh, ánh mắt điềm tĩnh.',
    personality:
      'Điềm tĩnh, kín tiếng và thực tế kiểu London; nói chuyện ngắn gọn, giọng Anh trầm rõ nhịp, hiếm khi tỏ ra phấn khích quá mức kể cả giữa bữa tiệc đông người.',
    relationships:
      'Gần gũi với ê-kíp từ London, giữ khoảng cách lịch sự nhưng tinh ý quan sát giới nghệ sĩ và người nổi tiếng tại Los Angeles.',
    signature:
      'Thói quen xoay nhẹ nhẫn/đồng hồ trên tay và hay quan sát cả căn phòng từ góc khuất với nụ cười nửa miệng.',
  },
  {
    canonicalName: 'MGK',
    aliases: ['machine gun kelly', 'colson baker'],
    role: 'Ca sĩ / Rapper',
    birthday: '22/04/1990',
    fashionStyle:
      'Punk-rock / Glam-rock nổi loạn: áo khoác da đinh tán, áo tanktop hoặc sơ mi họa tiết xẻ sâu khoe hình xăm, quần da/denim rách phối dày đặc nhẫn bạc, vòng cổ xích và sơn móng tay.',
    appearance:
      'Nam nghệ sĩ Mỹ rất cao và gầy, tóc bạch kim rối nhẹ phong cách punk-rock, nhiều hình xăm dày đặc phủ kín cổ, ngực và cánh tay.',
    personality:
      'Phóng khoáng, bốc đồng và giàu năng lượng nổi loạn; nói chuyện trực tính, hay pha trò bất ngờ và dễ bị cuốn theo bầu không khí tiệc tùng.',
    relationships:
      'Dễ bắt chuyện với giới nhạc sĩ, rapper và các gương mặt nổi loạn trong làng giải trí Hollywood, chuộng kiểu tương tác tự nhiên không màu mè.',
    signature:
      'Nụ cười nhếch mép đặc trưng, hay gõ nhịp theo tiếng nhạc bằng những ngón tay đeo đầy nhẫn bạc.',
  },
  {
    canonicalName: 'Zac Bia',
    role: 'DJ / Doanh nhân giải trí',
    birthday: '09/06/1996',
    fashionStyle:
      'Streetwear LA cao cấp kết hợp nightlife casual: áo khoác bomber/denim dáng rộng, áo thun vintage hoặc sơ mi mở cổ, quần suông, kính râm gọng nhỏ và trang sức vàng tối giản.',
    appearance:
      'Nam DJ kiêm doanh nhân trẻ tại Los Angeles, tóc nâu xoăn nhẹ rẽ tự nhiên, râu ria gọn gàng, thần thái tiệc tùng thoải mái.',
    personality:
      'Khéo léo, hòa đồng và cực kỳ nhạy với bầu không khí đám đông; luôn giữ thái độ nhẹ nhàng, kiểm soát nhịp tiệc và kết nối mọi người một cách tự nhiên.',
    relationships:
      'Mắt xích quen mặt trong giới tiệc tùng Beverly Hills và Hollywood, quen biết rộng từ siêu mẫu, rapper đến các nhà sản xuất âm nhạc.',
    signature:
      'Thường đứng gần bàn nhạc hoặc góc quầy bar, luôn biết cách hạ nhiệt căng thẳng chỉ bằng một câu đùa đúng lúc hoặc đổi bản nhạc.',
  },
  {
    canonicalName: 'Kendall Jenner',
    aliases: ['kendall'],
    role: 'Siêu mẫu',
    birthday: '03/11/1995',
    fashionStyle:
      'Quiet luxury tối giản sang trọng kiểu The Row / Bottega Veneta: áo khoác dáng dài hoặc sơ mi tối giản, quần ống suông thanh lịch, đầm lụa slip dress ôm dáng tinh tế và phụ kiện nhỏ gọn.',
    appearance:
      'Siêu mẫu Mỹ vóc dáng cao mảnh mai, tóc nâu đen dài thẳng mượt rẽ ngôi giữa, gương mặt góc cạnh thanh tú, trang điểm tự nhiên tông nude.',
    personality:
      'Điềm đạm, hơi trầm và giữ khoảng cách thanh lịch hơn so với phần còn lại của gia đình; ăn nói gãy gọn, chuộng không gian riêng tư và tinh tế khi đánh giá người đối diện.',
    relationships:
      'Thân thiết với hội bạn siêu mẫu và giới thời trang Los Angeles; hòa nhã với chị em nhà Kardashian-Jenner nhưng vẫn giữ nét độc lập riêng.',
    signature:
      'Ánh nhìn thẳng điềm tĩnh, hay cầm ly rượu tequila hoặc tựa nhẹ bên lan can quan sát hơn là phô trương giữa đám đông.',
  },
  {
    canonicalName: 'Kim Kardashian',
    aliases: ['kim'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '21/10/1980',
    fashionStyle:
      'High-fashion ôm dáng tôn đường cong: đầm bodycon cắt xẻ sắc sảo, bodysuit trung tính cao cấp kiểu Balenciaga/SKIMS, áo khoác lông hoặc kính râm bản lớn nổi bật.',
    appearance:
      'Phụ nữ vóc dáng đồng hồ cát quyến rũ, tóc đen dài bóng mượt (hoặc uốn sóng nhẹ), trang điểm sắc sảo nhấn mắt khói và môi tông nude, thần thái tự tin quyền lực.',
    personality:
      'Sắc sảo, điềm tĩnh và luôn ý thức rõ sức hút lẫn hình ảnh trước đám đông; nói chuyện mềm mỏng nhưng đầy chủ đích, giữ đầu óc tỉnh táo ngay cả khi đối mặt tình huống bất ngờ.',
    relationships:
      'Trung tâm kết nối của gia tộc Kardashian-Jenner, lịch thiệp với giới giải trí hạng A và rất tinh ý đọc vị động cơ người khác.',
    signature:
      'Luôn giữ dáng đứng hoàn hảo trong mọi góc nhìn, giọng nói chậm rãi nhẹ nhàng nhưng đủ sức dẫn dắt cả cuộc trò chuyện.',
  },
  {
    canonicalName: 'Kris Jenner',
    role: 'Quản lý / Doanh nhân',
    birthday: '05/11/1955',
    fashionStyle:
      'Power-dressing sang trọng quyền lực: blazer hoặc suit nữ may đo cao cấp tông đen-trắng, áo cổ lọ lụa, kính râm mắt mèo và trang sức kim cương nổi bật.',
    appearance:
      'Phụ nữ trung niên sắc sảo sang trọng, mái tóc pixie đen cắt ngắn đặc trưng, trang điểm chỉn chu nổi bật đôi mắt kẻ đậm, phong thái quyền lực.',
    personality:
      'Quyết đoán, sắc bén và nhạy bén với cơ hội; ăn nói duyên dáng nhưng có uy, luôn nắm nhịp câu chuyện và xoay chuyển tình huống căng thẳng rất nhanh.',
    relationships:
      'Người cầm trịch gia tộc Kardashian-Jenner, giao thiệp rộng khắp giới doanh nhân, truyền thông và nghệ sĩ hàng đầu Hollywood.',
    signature:
      'Nụ cười ngoại giao hoàn hảo đi kèm ánh mắt tính toán nhanh nhạy và chiếc điện thoại hầu như không rời tay.',
  },
  {
    canonicalName: 'Kylie Jenner',
    aliases: ['kylie'],
    role: 'Doanh nhân / Ngôi sao mạng xã hội',
    birthday: '10/08/1997',
    fashionStyle:
      'Quyến rũ hiện đại pha nét tiểu thư tối giản: đầm cắt xẻ ôm dáng, corset thiết kế, đồ da bóng cao cấp hoặc váy lụa cổ điển tinh tế kèm túi xách mini xa xỉ.',
    appearance:
      'Nữ doanh nhân trẻ vóc dáng quyến rũ, tóc đen dài gợn sóng, đôi môi đầy đặn và lối trang điểm sắc nét cuốn hút.',
    personality:
      'Bề ngoài lạnh lùng quyến rũ nhưng thực tế khá kín đáo và chọn lọc người trò chuyện; giọng nói nhỏ nhẹ, phản ứng chừng mực khi gặp người lạ.',
    relationships:
      'Gắn bó chặt với gia đình và nhóm bạn thân quen thuộc, thường xuất hiện cùng Kendall hoặc các gương mặt trẻ nổi bật của Hollywood.',
    signature:
      'Phong thái sang chảnh khó đoán, chỉ thực sự thả lỏng khi trò chuyện với người trong vòng thân cận.',
  },
  {
    canonicalName: 'Khloé Kardashian',
    aliases: ['khloe kardashian'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '27/06/1984',
    fashionStyle:
      'Glam gợi cảm nổi bật: đầm dự tiệc ôm sát tôn dáng, jumpsuit lấp lánh hoặc denim ôm kết hợp áo khoác dáng dài, bốt cao gót và trang sức ánh kim bản lớn.',
    appearance:
      'Phụ nữ cao ráo vóc dáng săn chắc quyến rũ, tóc vàng mật ong dài uốn sóng, trang điểm sắc sảo nổi bật.',
    personality:
      'Thẳng thắn, hài hước và giàu năng lượng bảo vệ người thân; ăn nói bộc trực, dễ phá vỡ bầu không khí gượng gạo bằng câu đùa sắc sảo.',
    relationships:
      'Hết lòng vì gia đình và bạn bè thân thiết, sẵn sàng lên tiếng nếu thấy ai đó cư xử thiếu tôn trọng.',
    signature:
      'Tiếng cười phóng khoáng và những nhận xét thẳng băng không vòng vo.',
  },
  {
    canonicalName: 'Kourtney Kardashian',
    aliases: ['kourtney'],
    role: 'Ngôi sao truyền hình / Doanh nhân',
    birthday: '18/04/1979',
    fashionStyle:
      'Rock-chic pha cổ điển toàn tông đen: áo khoác da oversized, áo thun ban nhạc vintage, đầm ren đen ôm sát, bốt đế dày và kính râm gọng mảnh.',
    appearance:
      'Phụ nữ vóc dáng nhỏ nhắn thanh mảnh, tóc bob đen ngắn cá tính, gương mặt sắc nét.',
    personality:
      'Lạnh lùng kiểu tưng tửng, thích đặt ranh giới rõ ràng và không ngại nói thẳng điều mình nghĩ với giọng điệu bình thản.',
    relationships:
      'Ưu tiên không gian riêng và lối sống cá nhân, hay có những màn đối đáp sắc lạnh nhưng tự nhiên với các chị em.',
    signature:
      'Biểu cảm bình thản gần như không đổi trước mọi drama, kèm những câu đáp ngắn gọn đầy châm biếm nhẹ.',
  },
  {
    canonicalName: 'Jennie Kim',
    aliases: ['jennie'],
    role: 'Ca sĩ / Biểu tượng thời trang',
    birthday: '16/01/1996',
    fashionStyle:
      'High-fashion tiểu thư hiện đại pha streetwear cá tính (Chanel / Jacquemus): áo tweed ngắn, croptop phối quần ống rộng cạp trễ, đầm ngắn thanh lịch cùng kính râm và vòng cổ ngọc trai.',
    appearance:
      'Nữ ca sĩ Hàn Quốc vóc dáng mảnh mai cân đối, gương mặt thanh tú đôi mắt mèo sắc sảo, má bầu nhẹ dễ thương pha nét sang chảnh, tóc nâu đen dài mượt.',
    personality:
      'Vừa toát lên khí chất tiểu thư lạnh lùng tự tin, vừa có nét mềm mại hóm hỉnh khi thân quen; nói chuyện tinh tế, giọng nhẹ nhàng nhưng rất có chủ kiến và bản lĩnh trước áp lực.',
    relationships:
      'Được giới thời trang và âm nhạc quốc tế quý mến; hòa nhã với các nghệ sĩ ở Hollywood và giữ vòng bạn bè thân thiết chọn lọc.',
    signature:
      'Ánh mắt mèo hơi nheo lại khi quan sát điều thú vị và cách chuyển từ vẻ lạnh lùng sang nụ cười ấm áp chỉ trong một giây.',
  },
  {
    canonicalName: 'Rosé',
    aliases: ['rose', 'park chaeyoung', 'roseanne park'],
    role: 'Ca sĩ',
    birthday: '11/02/1997',
    fashionStyle:
      'Tối giản sang lạnh kiểu Saint Laurent: đầm đen ngắn tinh tế, áo khoác da hoặc áo len dệt kim dáng rộng phối quần cạp cao, trang sức vàng mảnh thanh thoát.',
    appearance:
      'Nữ ca sĩ vóc dáng cao thanh mảnh, mái tóc vàng bạch kim dài mượt đặc trưng, gương mặt thanh thoát khí chất mơ màng.',
    personality:
      'Nhạy cảm, tinh tế và lịch thiệp; ăn nói chân thành, giọng nói mềm pha nét phóng khoáng kiểu Úc, dễ đồng cảm với nghệ thuật và cảm xúc chân thật.',
    relationships:
      'Gần gũi với các nghệ sĩ âm nhạc và giới thời trang cao cấp, luôn giữ phong thái chân thành và tôn trọng người đối diện.',
    signature:
      'Thói quen vuốt nhẹ lọn tóc vàng khi suy nghĩ và ánh mắt sáng lên khi nhắc đến âm nhạc.',
  },
  {
    canonicalName: 'Lisa',
    aliases: ['lalisa', 'lalisa manobal'],
    role: 'Ca sĩ / Vũ công',
    birthday: '27/03/1997',
    fashionStyle:
      'Luxury streetwear cá tính sắc sảo (Louis Vuitton / Celine): áo khoác da dáng ngắn, croptop phối quần cargo hoặc chân váy da ngắn, bốt hầm hố và trang sức kim loại nổi bật.',
    appearance:
      'Nữ ca sĩ vóc dáng cao mảnh tỷ lệ chuẩn, đôi mắt to sắc sảo, tóc dài có mái bằng đặc trưng, thần thái tự tin cá tính.',
    personality:
      'Tươi sáng, hoạt bát và tràn đầy tự tin; dễ tạo thiện cảm bằng sự cởi mở nhưng lập tức sắc sảo, bản lĩnh khi bước vào tâm điểm chú ý.',
    relationships:
      'Hòa đồng với giới nghệ sĩ toàn cầu, mang lại năng lượng sôi nổi cho mọi cuộc tụ họp.',
    signature:
      'Nụ cười rạng rỡ tự nhiên đi kèm phong thái dứt khoát như bước ra từ sàn diễn.',
  },
  {
    canonicalName: 'Jisoo',
    aliases: ['kim jisoo'],
    role: 'Ca sĩ / Diễn viên',
    birthday: '03/01/1995',
    fashionStyle:
      'Tiểu thư thanh lịch cổ điển kiểu Dior: đầm chữ A mềm mại, áo cardigan hoặc áo sơ mi lụa phối chân váy xếp ly, túi xách cổ điển và trang sức mảnh tinh xảo.',
    appearance:
      'Nữ ca sĩ kiêm diễn viên Hàn Quốc nét đẹp cổ điển thanh lịch, tóc đen dài thẳng dịu dàng, nụ cười ngọt ngào.',
    personality:
      'Điềm đạm, vững vàng và hài hước duyên dáng kiểu tinh quái nhẹ; giữ bình tĩnh rất tốt trước tình huống bất ngờ.',
    relationships:
      'Chu đáo và dễ mến với bạn bè, luôn là điểm tựa điềm tĩnh trong nhóm.',
    signature:
      'Giọng nói trầm ấm dễ nhận ra và những câu đùa nhẹ nhàng làm dịu bầu không khí.',
  },
  {
    canonicalName: 'Leonardo DiCaprio',
    aliases: ['leo dicaprio'],
    role: 'Diễn viên Hollywood',
    birthday: '11/11/1974',
    fashionStyle:
      'Casual kín đáo kiểu Hollywood đời thường: áo khoác bomber hoặc jacket tối màu, áo thun trơn/polo tối giản, quần jeans tối màu, sneaker sạch và mũ lưỡi trai đen kéo thấp.',
    appearance:
      'Nam tài tử Hollywood trung niên, tóc nâu vàng chải gọn hoặc đội mũ lưỡi trai kín đáo, râu dê cắt tỉa gọn, ánh mắt sâu sắc điềm tĩnh.',
    personality:
      'Kín tiếng, từng trải và cực kỳ chuộng sự riêng tư; quan sát sắc bén, nói chuyện chậm rãi có trọng lượng và hiếm khi để lộ cảm xúc thật giữa chốn đông người.',
    relationships:
      'Có uy thế tự nhiên giữa giới điện ảnh và tiệc tùng Hollywood, chỉ trò chuyện sâu với nhóm bạn lâu năm hoặc những người cùng đẳng cấp.',
    signature:
      'Thói quen chọn góc khuất ánh đèn, kéo nhẹ vành mũ hoặc cầm ly đồ uống lắng nghe nhiều hơn nói.',
  },
  {
    canonicalName: "Finneas O'Connell",
    aliases: ['finneas'],
    role: 'Nhạc sĩ / Nhà sản xuất âm nhạc',
    birthday: '30/07/1997',
    fashionStyle:
      'Indie smart-casual thư sinh kiểu Los Angeles: áo sơ mi mở cổ họa tiết nhẹ hoặc áo len dệt kim, áo khoác da lộn/jacket dáng thoải mái phối quần ống suông và giày loafers hoặc bốt cổ thấp.',
    appearance:
      'Nam nhạc sĩ Mỹ vóc dáng cao thư sinh, tóc nâu đỏ/nâu sáng rẽ nhẹ tự nhiên, gương mặt sáng sủa điềm đạm.',
    personality:
      'Thông minh, lịch thiệp và có chiều sâu nghệ sĩ; nói chuyện mạch lạc pha chút hóm hỉnh trí thức, lắng nghe tinh tế và hiếm khi mất bình tĩnh.',
    relationships:
      'Được giới nhạc sĩ và ca sĩ nể trọng vì tài năng sản xuất âm nhạc, thân thiết với Billie Eilish và nhóm nghệ sĩ indie/pop tại Los Angeles.',
    signature:
      'Cách trò chuyện điềm đạm, hay chú ý đến chi tiết âm thanh hoặc giai điệu đang vang lên xung quanh.',
  },
  {
    canonicalName: 'Charli XCX',
    aliases: ['charli'],
    role: 'Ca sĩ nhạc Pop',
    birthday: '02/08/1992',
    fashionStyle:
      'Clubwear / Y2K tiệc tùng nổi loạn: áo khoác da ngắn, áo cut-out hoặc slip dress táo bạo, chân váy siêu ngắn, bốt da cao cổ và kính râm đen góc cạnh.',
    appearance:
      'Nữ ca sĩ Anh cá tính nổi loạn, mái tóc đen dài dày đánh rối tự nhiên, trang điểm mắt khói sắc nét, hay đeo kính râm đen.',
    personality:
      'Táo bạo, bộc trực và tràn đầy năng lượng tiệc tùng; ăn nói sắc sảo pha chút ngông nghênh duyên dáng, ghét sự giả tạo và luôn khuấy động bầu không khí.',
    relationships:
      'Trung tâm của những bữa tiệc đêm sành điệu, thân quen với giới DJ, nhạc sĩ điện tử và các biểu tượng pop phá cách.',
    signature:
      'Đeo kính râm đen ngay cả trong ánh đèn tiệc mờ ảo và hay nâng ly kéo mọi người vào nhịp nhạc.',
  },
  {
    canonicalName: 'Billie Eilish',
    aliases: ['billie'],
    role: 'Ca sĩ',
    birthday: '18/12/2001',
    fashionStyle:
      'Streetwear oversized đậm chất cá nhân: áo jersey hoặc sơ mi rộng nhiều lớp, quần baggy/short lửng rộng, giày sneaker hầm hố, mũ beanie và nhiều tầng vòng cổ/nhẫn bạc.',
    appearance:
      'Nữ ca sĩ Mỹ gương mặt góc cạnh với đôi mắt xanh lạnh đặc trưng, tóc tối màu hoặc nhuộm highlight nổi bật.',
    personality:
      'Chân thật, sắc sảo và có phần nổi loạn trầm lắng; ăn nói tự nhiên pha hài hước khô kiểu gen Z, không thích kiểu xã giao giả lả.',
    relationships:
      'Cực kỳ gắn bó với anh trai Finneas và vòng bạn bè nghệ sĩ thân cận; thẳng thắn nhưng ấm áp với người hợp tần số.',
    signature:
      'Ánh mắt nhìn nghiêng đặc trưng và điệu cười khẽ khi bắt gặp tình huống oái oăm.',
  },
  {
    canonicalName: 'Bella Hadid',
    role: 'Siêu mẫu',
    birthday: '09/10/1996',
    fashionStyle:
      'Vintage thập niên 90 pha haute couture sắc lạnh: áo khoác da cổ điển, áo tanktop hoặc đầm lụa cắt chéo ôm dáng, kính râm mắt nhỏ gọng kim loại và túi xách cổ điển.',
    appearance:
      'Siêu mẫu vóc dáng cao thanh mảnh, gương mặt sắc sảo xương gò má cao, mắt xanh lục quyến rũ, tóc nâu sẫm buộc gọn hoặc xõa thẳng.',
    personality:
      'Bên ngoài lạnh lùng bí ẩn kiểu sàn diễn nhưng khi mở lòng lại chân thành và sâu sắc; tinh ý quan sát cảm xúc người khác.',
    relationships:
      'Thân với hội siêu mẫu như Kendall và chị gái Gigi, được giới thời trang kính nể vì phong thái chuyên nghiệp.',
    signature:
      'Ánh mắt xanh sắc lạnh hút hồn và gu phối đồ cổ điển hiếm khi đụng hàng.',
  },
  {
    canonicalName: 'Gigi Hadid',
    role: 'Siêu mẫu',
    birthday: '23/04/1995',
    fashionStyle:
      'Thanh lịch hiện đại pha phóng khoáng California: áo len cashmere mềm, sơ mi dáng rộng phối denim chuẩn dáng hoặc đầm dạ hội bay bổng tôn vóc dáng khỏe khoắn.',
    appearance:
      'Siêu mẫu vóc dáng cao ráo khỏe khoắn, mái tóc vàng óng dài gợn sóng, gương mặt rạng rỡ đôi mắt xanh sáng.',
    personality:
      'Ấm áp, cởi mở và chín chắn; giao tiếp tự nhiên, dễ làm người đối diện thoải mái nhưng vẫn giữ sự tinh tế của ngôi sao hàng đầu.',
    relationships:
      'Gắn bó sâu sắc với Bella và hội bạn thời trang, khéo léo dung hòa nhiều nhóm bạn khác nhau.',
    signature:
      'Nụ cười rạng rỡ tự nhiên và phong thái phóng khoáng không chút kênh kiệu.',
  },
  {
    canonicalName: 'Hailey Bieber',
    aliases: ['hailey baldwin'],
    role: 'Người mẫu / Doanh nhân',
    birthday: '22/11/1996',
    fashionStyle:
      'Clean-girl hiện đại pha streetwear thanh lịch: áo khoác da dáng rộng hoặc trench coat, áo tanktop trắng/đầm đen tối giản, kính râm đen mảnh và hoa tai vàng bản tròn.',
    appearance:
      'Người mẫu Mỹ vóc dáng thon gọn, làn da căng bóng đặc trưng, tóc nâu hạt dẻ cắt bob hoặc búi gọn sau gáy.',
    personality:
      'Điềm tĩnh, chỉn chu và có gu thẩm mỹ rõ ràng; nói chuyện chừng mực, kiểm soát biểu cảm tốt trước ánh nhìn soi xét.',
    relationships:
      'Thân thiết với Kendall Jenner và vòng bạn thời trang Los Angeles, luôn giữ vẻ điềm đạm bên cạnh Justin.',
    signature:
      'Phong cách sạch sẽ sang trọng tối giản và ánh mắt quan sát tinh tế.',
  },
  {
    canonicalName: 'Justin Bieber',
    role: 'Ca sĩ',
    birthday: '01/03/1994',
    fashionStyle:
      'Streetwear phóng khoáng bất cần: hoodie hoặc áo khoác da dáng cực rộng, áo tanktop trắng, quần baggy thụng, mũ beanie hoặc mũ lưỡi trai đội ngược và giày sneaker cổ điển.',
    appearance:
      'Nam ca sĩ Canada gương mặt điển trai nhiều hình xăm ở cổ và tay, tóc cắt ngắn hoặc đội mũ beanie.',
    personality:
      'Phóng khoáng, nhạy cảm và chuộng sự thoải mái tự nhiên; dễ gần khi ở cạnh người thân quen nhưng kín đáo trước đám đông ồn ào.',
    relationships:
      'Gắn bó với Hailey và nhóm bạn nghệ sĩ thân thiết tại Los Angeles.',
    signature:
      'Cách ăn mặc bất cần nhưng cuốn hút và thói quen khẽ ngân nga theo nhịp nhạc nền.',
  },
  {
    canonicalName: 'Travis Scott',
    role: 'Rapper / Nhà sản xuất',
    birthday: '30/04/1991',
    fashionStyle:
      'Hip-hop streetwear tông đất / vintage hiếm: áo khoác workwear hoặc bomber cũ bụi, áo thun graphic, quần cargo túi hộp, giày sneaker giới hạn và trang sức kim cương.',
    appearance:
      'Nam rapper Mỹ vóc dáng săn chắc, mái tóc tết box braids đặc trưng, thần thái cool ngầu.',
    personality:
      'Trầm ngâm nhưng bùng nổ sáng tạo; nói ít, chuộng không khí âm nhạc sôi động và giữ phong thái ngầu lạnh.',
    relationships:
      'Có sức ảnh hưởng lớn trong giới hip-hop và thời trang đường phố, quen mặt tại các bữa tiệc nghệ sĩ hạng A.',
    signature:
      'Ánh mắt cúi thấp đầy bí ẩn và phong cách phối đồ streetwear hiếm có.',
  },
  {
    canonicalName: 'A$AP Rocky',
    aliases: ['asap rocky'],
    role: 'Rapper / Biểu tượng thời trang',
    birthday: '03/10/1988',
    fashionStyle:
      'High-fashion streetwear phá cách chuẩn sàn diễn Paris: áo khoác thiết kế độc bản (Bottega/Dior/AWGE), sơ mi hoặc knitwear layer tinh tế, quần ống rộng, khăn lụa/kính râm và nhiều nhẫn ngọc trai-kim cương.',
    appearance:
      'Nam rapper Mỹ gương mặt góc cạnh điển trai, mái tóc tết braids gọn gàng, nụ cười tự tin.',
    personality:
      'Lịch lãm, tự tin và có khiếu hài hước duyên dáng; nói chuyện lôi cuốn với phong thái nghệ sĩ New York phóng khoáng.',
    relationships:
      'Được giới thời trang và hip-hop ngưỡng mộ, giao tiếp cực kỳ mượt mà ở các buổi tiệc xa hoa.',
    signature:
      'Nụ cười sáng bừng đầy tự tin và bộ trang phục luôn như vừa bước xuống từ sàn diễn Paris.',
  },
  {
    canonicalName: 'Rihanna',
    role: 'Ca sĩ / Doanh nhân',
    birthday: '20/02/1988',
    fashionStyle:
      'Táo bạo sang trọng khí chất nữ hoàng: áo khoác lông hoặc áo khoác da oversized phối đầm lụa xẻ cao, layer dây chuyền kim cương nhiều tầng và kính râm thời thượng.',
    appearance:
      'Nữ ca sĩ quyến rũ thần thái nữ hoàng, đôi mắt xanh lục sắc sảo, làn da nâu khỏe khoắn, kiểu tóc thay đổi linh hoạt thời thượng.',
    personality:
      'Quyền lực, phóng khoáng và cực kỳ bản lĩnh; nói chuyện sắc bén pha chút dí dỏm tự nhiên, không bao giờ bị áp đảo bởi bất kỳ ai.',
    relationships:
      'Tâm điểm được cả giới âm nhạc lẫn thời trang nể trọng, tự nhiên dẫn dắt mọi không gian cô xuất hiện.',
    signature:
      'Thần thái ung dung cầm ly rượu vang và ánh nhìn tự tin làm chủ cả căn phòng.',
  },
  {
    canonicalName: 'Drake',
    role: 'Rapper / Ca sĩ',
    birthday: '24/10/1986',
    fashionStyle:
      'Luxury streetwear Bắc Mỹ (NOCTA / Chrome Hearts): áo khoác bomber hoặc jacket hàng hiệu dáng rộng, áo thun/hoodie chất dày, quần suông, đồng hồ xa xỉ và dây chuyền kim cương nổi bật.',
    appearance:
      'Nam rapper Canada vóc dáng vạm vỡ, râu quai nón cắt tỉa sắc nét, tóc ngắn hoặc tết gọn.',
    personality:
      'Hoạt ngôn, khéo léo và giàu cảm xúc; biết cách pha trò lẫn tạo không khí thân mật nhưng vẫn giữ cái tôi lớn của ngôi sao hàng đầu.',
    relationships:
      'Quan hệ rộng khắp giới âm nhạc, thể thao và giải trí Bắc Mỹ.',
    signature:
      'Cách nâng ly chúc mừng đầy hào phóng và những câu thoại nửa đùa nửa thật đầy ẩn ý.',
  },
  {
    canonicalName: 'The Weeknd',
    aliases: ['abel tesfaye'],
    role: 'Ca sĩ',
    birthday: '16/02/1990',
    fashionStyle:
      'Tối màu bí ẩn kiểu điện ảnh đêm khuya: áo khoác da đen hoặc bomber/trench tối màu, áo cổ lọ hoặc thun đen trơn, quần đen gọn, găng tay da hoặc kính râm gọng mảnh.',
    appearance:
      'Nam ca sĩ gốc Ethiopia-Canada, râu quai nón gọn gàng, tóc xoăn ngắn đen, ánh mắt trầm tư.',
    personality:
      'Trầm lắng, bí ẩn và kín tiếng; nói chuyện nhỏ nhẹ điềm đạm, mang sức hút trầm u buồn kiểu điện ảnh đêm khuya.',
    relationships:
      'Giữ vòng bạn bè nghệ sĩ chọn lọc tại Los Angeles và Hollywood.',
    signature:
      'Ánh mắt trầm tư dưới ánh đèn neon và phong thái đứng tách nhẹ khỏi sự ồn ào.',
  },
  {
    canonicalName: 'Playboi Carti',
    aliases: ['carti'],
    role: 'Rapper',
    birthday: '13/09/1995',
    fashionStyle:
      'Avant-garde gothic toàn màu đen (Rick Owens / Balenciaga): áo khoác da hầm hố độn vai, áo tanktop đen hoặc lưới, quần da/cargo đen rộng, bốt đế khủng và phụ kiện bạc sắc cạnh.',
    appearance:
      'Nam rapper Mỹ dáng cao gầy, tóc dreadlocks, thần thái lạnh lùng bí ẩn.',
    personality:
      'Kín tiếng, lập dị có chủ đích và khó nắm bắt; ít nói nhưng luôn gây chú ý mạnh bằng khí chất nổi loạn.',
    relationships:
      'Xuất hiện như bóng ma giữa các bữa tiệc đêm cùng nhóm cộng sự thân cận.',
    signature:
      'Cả cây đồ đen sắc lạnh và kiểu xuất hiện rồi biến mất bất ngờ.',
  },
  {
    canonicalName: 'SZA',
    role: 'Ca sĩ R&B',
    birthday: '08/11/1989',
    fashionStyle:
      'Phóng khoáng gợi cảm pha streetwear Y2K: áo jersey rộng hoặc corset tôn dáng, quần cargo/denim cạp trễ hoặc đầm ôm mềm mại kèm phụ kiện vàng và móng tay dài nghệ thuật.',
    appearance:
      'Nữ ca sĩ R&B vóc dáng quyến rũ, mái tóc xoăn dày bồng bềnh đặc trưng, gương mặt sắc nét đầy cảm xúc.',
    personality:
      'Nhạy cảm, chân thành và giàu chiều sâu cảm xúc; trò chuyện cởi mở pha chút hài hước tự trào dễ mến.',
    relationships:
      'Được nhiều nghệ sĩ yêu quý vì sự thật thà và năng lượng ấm áp.',
    signature:
      'Ánh mắt giàu biểu cảm và mái tóc xoăn bồng bềnh nổi bật giữa đám đông.',
  },
  {
    canonicalName: 'Bad Bunny',
    aliases: ['benito'],
    role: 'Ca sĩ / Rapper',
    birthday: '10/03/1994',
    fashionStyle:
      'Streetwear sáng tạo rực rỡ pha high-fashion: áo sơ mi họa tiết phóng khoáng hoặc áo khoác da nổi bật, quần ống rộng, mũ độc lạ, kính râm thiết kế cá tính và nhiều vòng cổ.',
    appearance:
      'Nam nghệ sĩ Puerto Rico cao ráo, râu ria gọn gàng, hay đeo kính râm kiểu lạ.',
    personality:
      'Phóng khoáng, tự tin và cuốn hút theo kiểu điềm nhiên; nói chuyện thoải mái, không bị ràng buộc bởi khuôn mẫu.',
    relationships:
      'Gần gũi với cộng đồng nghệ sĩ Latin và giới thời trang, giải trí Hollywood.',
    signature:
      'Kính râm thiết kế độc lạ và phong thái ung dung cực kỳ tự nhiên.',
  },
  {
    canonicalName: 'Timothée Chalamet',
    aliases: ['timothee chalamet'],
    role: 'Diễn viên',
    birthday: '27/12/1995',
    fashionStyle:
      'Nghệ sĩ trẻ phóng khoáng pha thiết kế phá cách (Haider Ackermann / Chrome Hearts): áo sơ mi lụa mở cổ, áo khoác bomber hoặc jacket da dáng gọn, quần ống đứng, bốt Chelsea và dây chuyền mảnh.',
    appearance:
      'Nam diễn viên trẻ dáng cao gầy thư sinh, mái tóc nâu xoăn bồng bềnh đặc trưng, đường nét gương mặt góc cạnh lãng tử.',
    personality:
      'Lanh lợi, hóm hỉnh và mang nét nghệ sĩ lãng tử; nói chuyện nhanh nhẹn, lịch thiệp và dễ tạo không khí thân thiện.',
    relationships:
      'Hòa nhập tự nhiên giữa giới điện ảnh lẫn thời trang cao cấp.',
    signature:
      'Thói quen vuốt ngược mái tóc xoăn rối nhẹ cùng nụ cười nghiêng đầy duyên.',
  },
  {
    canonicalName: 'Zendaya',
    role: 'Diễn viên / Ca sĩ',
    birthday: '01/09/1996',
    fashionStyle:
      'Thời trang cao cấp sắc sảo đầy biến hóa: đầm cut-out cấu trúc tinh xảo hoặc set đồ lụa/linen tối giản hiện đại tôn vóc dáng cao thanh thoát, trang sức Bvlgari nổi bật.',
    appearance:
      'Nữ diễn viên vóc dáng cao thanh mảnh, làn da nâu mật ong, tóc nâu uốn sóng hoặc búi sang trọng, thần thái sắc sảo cuốn hút.',
    personality:
      'Thông minh, chín chắn và tinh tế; giữ phong thái điềm đạm, ăn nói khéo léo đầy duyên dáng trong mọi tình huống.',
    relationships:
      'Được cả giới điện ảnh và thời trang quý mến, giữ đời tư kín đáo nhưng luôn thân thiện đúng mực.',
    signature:
      'Dáng vẻ thanh thoát đầy khí chất và ánh nhìn điềm tĩnh sắc sảo.',
  },
  {
    canonicalName: 'Dua Lipa',
    role: 'Ca sĩ',
    birthday: '22/08/1995',
    fashionStyle:
      'Tiệc tùng gợi cảm hiện đại pha disco sang trọng (Versace / YSL): đầm lụa hoặc đầm lưới ánh kim tôn dáng, áo khoác da dáng dài, bốt cao gót và trang sức bản to.',
    appearance:
      'Nữ ca sĩ Anh cao ráo quyến rũ, tóc dài đen mượt hoặc ánh đỏ trầm, hàng lông mày đậm sắc nét.',
    personality:
      'Tự tin, sắc sảo và tràn đầy sức sống; ăn nói trôi chảy, giọng Anh trầm quyến rũ, luôn thoải mái làm chủ bầu không khí.',
    relationships:
      'Thân thiện và rộng rãi quan hệ trong giới âm nhạc lẫn thời trang châu Âu và Mỹ.',
    signature:
      'Ánh mắt sâu quyến rũ và thần thái sang chảnh đầy nhịp điệu.',
  },
  {
    canonicalName: 'Sabrina Carpenter',
    role: 'Ca sĩ',
    birthday: '11/05/1999',
    fashionStyle:
      'Nữ tính cổ điển pha quyến rũ tinh nghịch: đầm babydoll hoặc corset ngắn tông pastel/đen, tất lưới hoặc giày cao gót đế độn và trang sức nhỏ lấp lánh.',
    appearance:
      'Nữ ca sĩ vóc dáng nhỏ nhắn ngọt ngào, mái tóc vàng óng uốn lọn bồng bềnh có mái bay đặc trưng, má hồng nổi bật.',
    personality:
      'Lanh lợi, sắc sảo và cực kỳ có duyên pha trò; vẻ ngoài ngọt ngào nhưng câu thoại luôn sắc bén, tinh nghịch.',
    relationships:
      'Dễ bắt nhịp với giới nghệ sĩ trẻ Hollywood bằng sự duyên dáng và tự tin.',
    signature:
      'Cái nháy mắt tinh nghịch và những câu đối đáp ngắn gọn đầy hài hước.',
  },
  {
    canonicalName: 'Sydney Sweeney',
    role: 'Diễn viên',
    birthday: '12/09/1997',
    fashionStyle:
      'Hollywood gợi cảm hiện đại (Miu Miu): đầm lụa ôm sát hoặc đầm cổ khoét thanh lịch, set áo khoác ngắn phối chân váy tôn vóc dáng và trang sức sáng nhẹ.',
    appearance:
      'Nữ diễn viên Mỹ tóc vàng dài bồng bềnh, đôi mắt xanh to cuốn hút, vóc dáng gợi cảm.',
    personality:
      'Thẳng thắn, chăm chỉ và điềm tĩnh hơn vẻ ngoài ngọt ngào; biết cách giữ bình tĩnh và kiểm soát cuộc trò chuyện.',
    relationships:
      'Thân thiện với đồng nghiệp Hollywood, khéo léo giữ cân bằng giữa công việc và tiệc tùng.',
    signature:
      'Ánh mắt mơ màng cổ điển ẩn sau sự sắc sảo thực tế.',
  },
  {
    canonicalName: 'Lana Del Rey',
    role: 'Ca sĩ',
    birthday: '21/06/1985',
    fashionStyle:
      'Vintage Mỹ thập niên 60 lãng mạn: đầm lụa hoặc ren dáng dài hoài cổ, áo khoác da lộn tua rua hoặc cardigan nhẹ phối dây chuyền mảnh và nơ cài tóc cổ điển.',
    appearance:
      'Nữ ca sĩ Mỹ nét đẹp hoài cổ thập niên 60, mái tóc nâu dài uốn lọn cổ điển, kẻ mắt sắc nét và thần thái mơ màng.',
    personality:
      'Trầm lắng, lãng mạn và đầy chất thơ; nói chuyện chậm rãi dịu dàng, toát lên khí chất hoài cổ khó lẫn.',
    relationships:
      'Được nhiều nghệ sĩ trẻ ngưỡng mộ, thích những cuộc trò chuyện sâu sắc yên tĩnh hơn tiệc ồn ào.',
    signature:
      'Giọng nói mơ màng êm ái và ánh nhìn như bước ra từ phim nhựa Hollywood xưa.',
  },
  {
    canonicalName: 'Taylor Swift',
    role: 'Ca sĩ / Nhạc sĩ',
    birthday: '13/12/1989',
    fashionStyle:
      'Thanh lịch hiện đại pha hơi hướng cổ điển New York: áo khoác dáng dài hoặc đầm ôm tối giản sang trọng, áo len cổ lọ phối chân váy ngắn, bốt da cao và trang sức vàng thanh nhã.',
    appearance:
      'Nữ ca sĩ Mỹ vóc dáng cao ráo, mái tóc vàng dài kèm mái bằng đặc trưng, mắt kẻ cánh sắc nét và son môi đỏ cổ điển.',
    personality:
      'Sắc sảo, ấm áp và cực kỳ tinh tế trong giao tiếp; luôn chú ý đến từng chi tiết nhỏ và phản ứng nhanh nhạy.',
    relationships:
      'Quan hệ rộng khắp làng âm nhạc, luôn thể hiện sự hào phóng và tinh thần đồng đội với bạn bè thân.',
    signature:
      'Bờ môi đỏ cổ điển và ánh mắt quan sát nhanh như đang ghi nhớ từng câu chuyện để viết nhạc.',
  },
  {
    canonicalName: 'Ariana Grande',
    role: 'Ca sĩ / Diễn viên',
    birthday: '26/06/1993',
    fashionStyle:
      'Nữ tính tinh tế pha cổ điển ngọt ngào: đầm chữ A hoặc đầm lụa tông trung tính-pastel, áo cardigan ngắn phối chân váy gọn gàng và trang sức ngọc trai-kim cương mảnh.',
    appearance:
      'Nữ ca sĩ vóc dáng nhỏ nhắn thanh mảnh, mái tóc dài buộc cao đặc trưng, trang điểm mắt mèo sắc sảo ngọt ngào.',
    personality:
      'Dịu dàng, tinh tế nhưng rất kiên định về nghệ thuật; ăn nói nhẹ nhàng pha nét hóm hỉnh.',
    relationships:
      'Thân thiết với nhóm cộng sự lâu năm và các nghệ sĩ cùng gu âm nhạc.',
    signature:
      'Giọng nói ngọt nhẹ và biểu cảm mềm mại thanh lịch.',
  },
  {
    canonicalName: 'Selena Gomez',
    role: 'Ca sĩ / Diễn viên',
    birthday: '22/07/1992',
    fashionStyle:
      'Thanh lịch quyến rũ kiểu Hollywood hiện đại: đầm đen cổ điển tôn dáng, áo khoác dạ mềm phối quần âu cạp cao và hoa tai tròn ánh vàng tinh tế.',
    appearance:
      'Nữ nghệ sĩ Mỹ gương mặt bầu bĩnh duyên dáng, đôi mắt nâu ấm áp, tóc nâu đen dài uốn nhẹ.',
    personality:
      'Chân thành, điềm đạm và ấm áp; ăn nói thẳng thắn nhẹ nhàng, biết cách lắng nghe người đối diện.',
    relationships:
      'Trân trọng những mối quan hệ bền lâu và không khí gần gũi chân thật.',
    signature:
      'Nụ cười ấm áp dễ tạo thiện cảm và giọng nói trầm nhẹ đặc trưng.',
  },
  {
    canonicalName: 'G-Dragon',
    aliases: ['kwon jiyong', 'gd'],
    role: 'Ca sĩ / Biểu tượng thời trang',
    birthday: '18/08/1988',
    fashionStyle:
      'Avant-garde phi giới tính phá cách (Chanel / PEACEMINUSONE): áo khoác tweed hoặc cardigan cài ghim hoa cúc, khăn choàng lụa, quần ống rộng, mũ nồi/beanie và nhiều lớp nhẫn vòng nghệ thuật.',
    appearance:
      'Nam nghệ sĩ Hàn Quốc dáng thanh mảnh, thần thái nghệ sĩ nổi loạn, kiểu tóc thời thượng.',
    personality:
      'Ngẫu hứng, sắc sảo và mang khí chất nghệ sĩ khó trộn lẫn; khiêm tốn lịch thiệp khi trò chuyện nhưng toát ra sức hút áp đảo không cần cố gắng.',
    relationships:
      'Biểu tượng được giới thời trang và nghệ sĩ toàn cầu nể trọng.',
    signature:
      'Cử chỉ ngẫu hứng đầy nghệ sĩ và gu phối phụ kiện độc nhất vô nhị.',
  },
  {
    canonicalName: 'Kanye West',
    aliases: ['ye'],
    role: 'Rapper / Nhà thiết kế',
    birthday: '08/06/1977',
    fashionStyle:
      'Tối giản oversized tông màu trầm / đơn sắc (Yeezy): áo hoodie phom hộp cực rộng, áo khoác kỹ thuật tối màu, quần thụng và bốt hầm hố không họa tiết.',
    appearance:
      'Nam nghệ sĩ Mỹ vóc dáng chắc khỏe, đầu cạo gọn, râu quai nón ngắn, thần thái nghiêm nghị.',
    personality:
      'Cực đoan theo chủ nghĩa hoàn hảo, bộc trực và đầy tự tin; nói thẳng những ý tưởng táo bạo không theo lối mòn.',
    relationships:
      'Gây ảnh hưởng mạnh mẽ nhưng cũng nhiều tranh cãi trong giới âm nhạc và thời trang.',
    signature:
      'Ánh nhìn nghiêm nghị không cười và những tuyên ngôn bất ngờ.',
  },
  {
    canonicalName: 'Troye Sivan',
    role: 'Ca sĩ / Diễn viên',
    birthday: '05/06/1995',
    fashionStyle:
      'Tối giản hiện đại giàu chất nghệ sĩ (Prada / Miu Miu): áo tanktop hoặc sơ mi dáng rộng hờ hững, áo khoác da dáng ngắn, quần ống đứng và phụ kiện bạc mảnh.',
    appearance:
      'Nam ca sĩ dáng mảnh thư sinh, tóc nâu xoăn nhẹ tự nhiên, gương mặt thanh tú đôi mắt xanh sáng.',
    personality:
      'Duyên dáng, tinh tế và phóng khoáng; trò chuyện tự nhiên đầy hóm hỉnh, dễ hòa nhịp với giới sáng tạo trẻ.',
    relationships:
      'Thân thiết với nhóm nghệ sĩ pop/club như Charli XCX và giới thời trang quốc tế.',
    signature:
      'Nụ cười thư sinh tinh nghịch và phong thái nhẹ nhàng đầy chất nghệ.',
  },
];

const CELEBRITY_LOOKUP_MAP = new Map<string, KnownCelebrityProfile>();
for (const celeb of KNOWN_CELEBRITY_LIST) {
  CELEBRITY_LOOKUP_MAP.set(normalizeCharacterKey(celeb.canonicalName), celeb);
  for (const alias of celeb.aliases || []) {
    CELEBRITY_LOOKUP_MAP.set(normalizeCharacterKey(alias), celeb);
  }
}

export function lookupKnownCelebrityProfile(
  name: string,
): KnownCelebrityProfile | null {
  const key = normalizeCharacterKey(name);
  if (!key) return null;
  return CELEBRITY_LOOKUP_MAP.get(key) || null;
}

function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findKnownCelebritiesInText(
  text: string,
): Array<{
  displayName: string;
  canonicalName: string;
  lastIndex: number;
  count: number;
}> {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const hits: Array<{
    displayName: string;
    canonicalName: string;
    lastIndex: number;
    count: number;
  }> = [];

  for (const celeb of KNOWN_CELEBRITY_LIST) {
    const terms = [celeb.canonicalName, ...(celeb.aliases || [])]
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    let bestLast = -1;
    let totalCount = 0;
    let preferredDisplay = celeb.canonicalName;
    let preferredCount = 0;

    for (const term of terms) {
      const isSingleWord = !/\s/.test(term);
      const escaped = escapeRegExpChars(term);
      const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
      let m: RegExpExecArray | null;
      let termCount = 0;
      let lastMatchedText = '';
      while ((m = re.exec(raw)) !== null) {
        if (isSingleWord && !/^[\p{Lu}]/u.test(m[0])) continue;
        termCount += 1;
        totalCount += 1;
        if (m.index > bestLast) {
          bestLast = m.index;
          lastMatchedText = m[0];
        }
      }
      if (termCount > preferredCount && lastMatchedText) {
        preferredCount = termCount;
        preferredDisplay = lastMatchedText.trim();
      }
    }

    if (totalCount > 0 && bestLast >= 0) {
      hits.push({
        displayName: preferredDisplay,
        canonicalName: celeb.canonicalName,
        lastIndex: bestLast,
        count: totalCount,
      });
    }
  }

  hits.sort((a, b) => b.lastIndex - a.lastIndex || b.count - a.count);
  return hits;
}

const CONTRACTION_RE =
  /\b(?:i'm|i've|i'll|i'd|it's|he's|she's|they're|they've|they'll|they'd|we're|we've|we'll|we'd|you're|you've|you'll|you'd|that's|there's|here's|what's|who's|where's|when's|why's|how's|let's|don't|doesn't|didn't|can't|won't|wouldn't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|ain't|mustn't)\b/i;

const JUNK_EXACT_PHRASES = new Set([
  'setting',
  'the setting',
  'defining the setting',
  'guest list',
  'the guest list',
  'expanding the guest list',
  'narrative flow',
  'the narrative flow',
  'crafting the narrative flow',
  'analyzing the aftermath',
  'analysing the aftermath',
  'aftermath',
  'the aftermath',
  'scene',
  'the scene',
  'stage',
  'plan',
  'the plan',
  'plan for',
  'plan for stage',
  'goal',
  'goals',
  'the goal',
  'word count',
  'words per paragraph',
  'the room',
  'room',
  'party',
  'the party',
  'after party',
  'after-party',
  'vip',
  'vip room',
  'vip lounge',
  'vip area',
  'vip section',
  'club',
  'the club',
  'nightclub',
  'rooftop bar',
  'system boot',
  'resource loading',
  'dialogue',
  'narration',
  'narrator',
  'pacing',
  'tone',
  'atmosphere',
  'transition',
  'character',
  'characters',
  'character check',
  'character voice',
  'self check',
  'continuity check',
  'thought process',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'outline',
  'draft',
  'drafting',
  'summary',
  'status',
  'checklist',
  'constraints',
  'instructions',
  'execution',
  'review',
  'verification',
  'ooc',
  'pov',
  'npc',
  'mc',
  'protagonist',
  'los angeles',
  'new york',
  'new york city',
  'beverly hills',
  'hollywood hills',
  'hollywood',
  'west hollywood',
  'las vegas',
  'san francisco',
  'miami',
  'london',
  'paris',
  'seoul',
  'tokyo',
  'hong kong',
  'south korea',
  'united states',
  'united kingdom',
  'viet nam',
  'sai gon',
  'ha noi',
  'da nang',
  'thuong hai',
  'bac kinh',
  'rolls royce',
  'louis vuitton',
  'chrome hearts',
  'saint laurent',
  'bottega veneta',
  'ralph lauren',
  'dom perignon',
  'audemars piguet',
  'patek philippe',
  'richard mille',
  'mercedes benz',
  'aston martin',
  'range rover',
  'balenciaga',
  'chanel',
  'dior',
  'gucci',
  'prada',
  'hermes',
  'versace',
  'cartier',
  'rolex',
  'met gala',
  'fashion week',
  'grammy',
  'grammys',
  'coachella',
  'cannes',
  'sunset boulevard',
  'rodeo drive',
  'mulholland drive',
  'chateau marmont',
  'delilah',
  'nobu',
  'catch',
  'penthouse',
  'mansion',
  'villa',
  'living room',
  'dance floor',
  'bar counter',
  'main hall',
  'private suite',
  'private room',
  'main stage',
  'backstage',
  'red carpet',
  'press conference',
  'social media',
  'instagram',
  'tiktok',
  'twitter',
  'youtube',
  'spotify',
  'paparazzi',
  'security',
  'bodyguard',
  'bartender',
  'waiter',
  'manager',
  'assistant',
  'producer',
  'director',
]);

const JUNK_SINGLE_WORDS = new Set([
  'setting',
  'guest',
  'guests',
  'list',
  'scene',
  'stage',
  'plan',
  'planning',
  'goal',
  'goals',
  'word',
  'words',
  'count',
  'paragraph',
  'paragraphs',
  'room',
  'party',
  'vip',
  'club',
  'bar',
  'lounge',
  'penthouse',
  'mansion',
  'villa',
  'hotel',
  'suite',
  'balcony',
  'terrace',
  'hallway',
  'kitchen',
  'bedroom',
  'bathroom',
  'floor',
  'table',
  'sofa',
  'couch',
  'door',
  'window',
  'night',
  'evening',
  'morning',
  'midnight',
  'moment',
  'silence',
  'music',
  'drink',
  'drinks',
  'wine',
  'champagne',
  'cocktail',
  'vape',
  'smoke',
  'narrative',
  'flow',
  'aftermath',
  'dialogue',
  'narration',
  'pacing',
  'tone',
  'atmosphere',
  'transition',
  'outline',
  'draft',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'summary',
  'status',
  'system',
  'boot',
  'resource',
  'loading',
  'section',
  'chapter',
  'page',
  'turn',
  'beat',
  'beats',
  'step',
  'phase',
  'part',
  'note',
  'notes',
  'rule',
  'rules',
  'check',
  'checklist',
  'constraint',
  'constraints',
  'defining',
  'expanding',
  'crafting',
  'analyzing',
  'analysing',
  'establishing',
  'developing',
  'building',
  'checking',
  'reviewing',
  'introducing',
  'focusing',
  'maintaining',
  'ensuring',
  'highlighting',
  'exploring',
  'managing',
  'considering',
  'evaluating',
  'determining',
  'the',
  'and',
  'but',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'over',
  'under',
  'about',
  'this',
  'that',
  'these',
  'those',
  'here',
  'there',
  'where',
  'when',
  'while',
  'then',
  'now',
  'just',
  'only',
  'even',
  'still',
  'also',
  'very',
  'more',
  'most',
  'some',
  'many',
  'much',
  'each',
  'every',
  'both',
  'all',
  'any',
  'none',
  'one',
  'two',
  'three',
  'first',
  'second',
  'third',
  'next',
  'last',
  'final',
  'finally',
  'after',
  'before',
  'during',
  'however',
  'although',
  'because',
  'since',
  'until',
  'unless',
  'maybe',
  'perhaps',
  'suddenly',
  'slowly',
  'quickly',
  'quietly',
  'softly',
  'gently',
  'clearly',
  'actually',
  'really',
  'simply',
  'meanwhile',
  'instead',
  'he',
  'she',
  'it',
  'we',
  'they',
  'you',
  'him',
  'her',
  'them',
  'his',
  'our',
  'their',
  'your',
  'my',
  'me',
  'us',
  'who',
  'whom',
  'whose',
  'which',
  'what',
]);

const JUNK_TOKEN_CONTAINMENT = new Set([
  'setting',
  'guest',
  'list',
  'scene',
  'stage',
  'plan',
  'planning',
  'goal',
  'goals',
  'word',
  'words',
  'count',
  'paragraph',
  'paragraphs',
  'narrative',
  'flow',
  'aftermath',
  'defining',
  'expanding',
  'crafting',
  'analyzing',
  'analysing',
  'establishing',
  'developing',
  'checking',
  'reviewing',
  'confirming',
  'verifying',
  'validating',
  'refining',
  'structuring',
  'outlining',
  'framing',
  'balancing',
  'introducing',
  'incorporating',
  'exploring',
  'managing',
  'navigating',
  'handling',
  'considering',
  'evaluating',
  'designing',
  'writing',
  'mapping',
  'tracking',
  'focusing',
  'maintaining',
  'ensuring',
  'assessing',
  'determining',
  'identifying',
  'selecting',
  'orchestrating',
  'weaving',
  'shaping',
  'tuning',
  'adjusting',
  'aligning',
  'synthesizing',
  'brainstorming',
  'finalizing',
  'wrapping',
  'addressing',
  'continuing',
  'deepening',
  'escalating',
  'heightening',
  'concluding',
  'resolving',
  'capturing',
  'portraying',
  'depicting',
  'applying',
  'following',
  'respecting',
  'adhering',
  'preparing',
  'initiating',
  'executing',
  'polishing',
  'formatting',
  'updating',
  'reconciling',
  'integrating',
  'grounding',
  'anchoring',
  'elevating',
  'amplifying',
  'intensifying',
  'layering',
  'immersing',
  'rendering',
  'composing',
  'generating',
  'delivering',
  'completing',
  'finishing',
  'transitioning',
  'shifting',
  'building',
  'creating',
  'observing',
  'noting',
  'recalling',
  'directive',
  'directives',
  'temporal',
  'continuity',
  'intimate',
  'progression',
  'sensory',
  'detail',
  'details',
  'perspective',
  'perspectives',
  'dynamics',
  'dynamic',
  'consistency',
  'instruction',
  'instructions',
  'guideline',
  'guidelines',
  'objective',
  'objectives',
  'element',
  'elements',
  'structure',
  'transition',
  'transitions',
  'resolution',
  'interaction',
  'interactions',
  'emotional',
  'physical',
  'sensual',
  'context',
  'timeline',
  'chronology',
  'character',
  'characters',
  'response',
  'responses',
  'description',
  'descriptions',
  'tone',
  'voice',
  'beats',
  'plot',
  'summary',
  'notes',
  'overview',
  'approach',
  'strategy',
  'focus',
  'theme',
  'mood',
  'tension',
  'chemistry',
  'momentum',
  'rhythm',
  'nuance',
  'nuances',
  'subtext',
  'imagery',
  'language',
  'register',
  'draft',
  'review',
  'check',
  'update',
  'state',
  'memory',
  'history',
  'profile',
  'location',
  'clock',
  'prompt',
  'input',
  'output',
  'format',
  'section',
  'phase',
  'step',
  'protocol',
  'logic',
  'analysis',
  'thought',
  'system',
  'boot',
  'resource',
  'loading',
  'thinking',
  'reasoning',
  'outline',
  'drafting',
  'checklist',
  'constraint',
  'constraints',
  'pacing',
  'dialogue',
  'monologue',
  'narration',
  'room',
  'party',
  'club',
  'lounge',
  'vip',
  'penthouse',
  'mansion',
  'balcony',
  'terrace',
  'hallway',
  'bathroom',
  'bedroom',
  'kitchen',
  'floor',
  'boulevard',
  'avenue',
  'street',
  'hotel',
  'suite',
  'restaurant',
]);

const SAFE_ING_SURNAMES = new Set([
  'sterling',
  'fleming',
  'browning',
  'channing',
  'harding',
  'manning',
  'fielding',
  'spalding',
  'golding',
  'irving',
  'henning',
  'jennings',
  'cummings',
  'darling',
  'redding',
  'welling',
  'billing',
  'keeling',
  'kelling',
  'ewing',
  'king',
  'ling',
  'ming',
  'ning',
  'ping',
  'qing',
  'sing',
  'ting',
  'wing',
  'xing',
  'ying',
  'zing',
]);

const ENGLISH_CONNECTOR_WORDS = new Set([
  'the',
  'and',
  'or',
  'of',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'about',
  'through',
  'between',
  'without',
  'against',
  'toward',
  'towards',
  'under',
  'over',
  'after',
  'before',
  'during',
  'by',
  'to',
  'in',
  'on',
  'at',
  'as',
]);

const VIET_DIACRITIC_CHAR_RE =
  /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

const ENGLISH_ABSTRACT_HEADING_SUFFIX_RE =
  /(?:tions?|sions?|ments?|ities|ity|ness|ances?|ences?|ives|ories|ory|ology|isms?|izing|ising|ating|ifying|icals?|tials?|urals?)$/i;

/**
 * Returns true if the given string looks like an English CoT/thinking section heading,
 * editorial planning phrase, or non-person abstract Title Case phrase
 * (e.g. "Confirming Directives", "Checking Temporal Continuity",
 * "Planning the Intimate Progression", "Refining Sensory Details and Perspective").
 */
export function isEnglishHeadingOrMetaPhrase(raw: string): boolean {
  const cleaned = String(raw || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2) return false;

  // Known celebrities are always real people
  if (lookupKnownCelebrityProfile(cleaned)) return false;

  // Vietnamese phrases with diacritics are handled separately (not English CoT headings)
  if (VIET_DIACRITIC_CHAR_RE.test(cleaned)) return false;

  const key = normalizeCharacterKey(cleaned);
  if (!key) return false;
  const tokens = key.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  // Any explicit CoT / editorial / meta token disqualifies the phrase
  if (tokens.some((tok) => JUNK_TOKEN_CONTAINMENT.has(tok))) {
    return true;
  }

  // English gerund (-ing) verb in leading position or inside multi-word phrase
  for (const tok of tokens) {
    if (
      tok.length >= 6 &&
      tok.endsWith('ing') &&
      !SAFE_ING_SURNAMES.has(tok)
    ) {
      return true;
    }
  }

  // Multi-word pure-ASCII checks
  if (tokens.length >= 2) {
    // Real person names do not contain English connectors like "the", "and", "for", "with"
    if (tokens.some((tok) => ENGLISH_CONNECTOR_WORDS.has(tok))) {
      return true;
    }
    // Abstract editorial / nominal suffixes (e.g. Directives, Continuity, Progression, Perspective, Sensory)
    if (
      tokens.some(
        (tok) => tok.length >= 6 && ENGLISH_ABSTRACT_HEADING_SUFFIX_RE.test(tok),
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if an entire line is an English Title Case / Markdown CoT heading
 * (such as "**Confirming Directives**", "Checking Temporal Continuity",
 * "Planning the Intimate Progression", "Refining Sensory Details and Perspective").
 */
export function isEnglishTitleCaseHeadingLine(rawLine: string): boolean {
  const trimmed = String(rawLine || '').trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) return false;
  if (VIET_DIACRITIC_CHAR_RE.test(trimmed)) return false;

  const isMarkdownWrapped =
    /^(?:[-*+•>]\s*)?(?:\d+[.)]\s*)?(?:#+\s+.+|(?:\*\*|__)[^*\n]{3,100}(?:\*\*|__)\s*:?)$/.test(
      trimmed,
    );

  const stripped = trimmed
    .replace(/^(?:[-*+•>]\s*|\d+[.)]\s*|#+\s*)+/, '')
    .replace(/^(?:\*\*|__)+|(?:\*\*|__)+$/g, '')
    .replace(/:$/, '')
    .trim();

  if (!stripped || lookupKnownCelebrityProfile(stripped)) return false;

  // Ignore dialogue lines or full sentences ending with period/question/exclamation
  if (/["“”«»]/.test(stripped) || /[.!?…]$/.test(stripped)) {
    return false;
  }

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;

  // Every token should be ASCII letters/hyphens/apostrophes/ampersand
  if (!words.every((w) => /^[A-Za-z][A-Za-z'’&-]*$/.test(w))) {
    return false;
  }

  if (isEnglishHeadingOrMetaPhrase(stripped)) {
    return true;
  }

  // Standalone bold/hash heading in pure English with Title Case words
  const contentWords = words.filter(
    (w) => !ENGLISH_CONNECTOR_WORDS.has(w.toLowerCase()),
  );
  if (!contentWords.length) return false;
  const capitalizedRatio =
    contentWords.filter((w) => /^[A-Z]/.test(w)).length / contentWords.length;

  if (isMarkdownWrapped && capitalizedRatio >= 0.7 && contentWords.length >= 2) {
    return true;
  }

  return false;
}

const LEADING_ENGLISH_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'by',
  'as',
  'if',
  'or',
  'and',
  'but',
  'so',
  'yet',
  'now',
  'just',
  'here',
  'there',
  'then',
  'when',
  'where',
  'while',
  'after',
  'before',
  'during',
  'into',
  'onto',
  'over',
  'under',
  'about',
  'around',
  'through',
  'between',
  'without',
  'within',
  'behind',
  'beside',
  'inside',
  'outside',
  'across',
  'against',
  'toward',
  'towards',
  'from',
  'with',
  'near',
  'next',
  'he',
  'she',
  'it',
  'we',
  'they',
  'you',
  'i',
]);

export function sanitizeCharacterName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): string | null {
  let name = String(rawName || '')
    .replace(/[*_`~#<>]+/g, '')
    .replace(/^[\s"'“”‘’(\[.,!?;:–—-]+|[\s"'“”‘’.,!?;:)\[\]–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 2 || name.length > 42) return null;

  // Reject anything containing internal line breaks, brackets, slashes, or sentence punctuation
  if (/[\r\n()\[\]{};:!?/\\|@#$%^&*+=~]/.test(name)) {
    // Allow explicit "$" only for stage names like A$AP Rocky or known roster entries
    const keyTry = normalizeCharacterKey(name);
    const isDollarStage = /^[A-Z]\$[A-Z]{2,}(?:\s+[A-Z][\p{Ll}]+)?$/u.test(name);
    if (!isDollarStage && !(allowedKnownKeys && allowedKnownKeys.has(keyTry))) {
      return null;
    }
  }

  // Reject contractions anywhere in the candidate (e.g. "Setting I'm", "Guest List I've", "It's Kendall Jenner's", "He's", "She's", "They're", "We're")
  if (CONTRACTION_RE.test(name.replace(/[’`]/g, "'"))) {
    return null;
  }

  // Reject internal period unless it's a clean single-letter initial like "J. Cole" or "A.J."
  if (name.includes('.')) {
    const validInitialsOnly = name
      .split(/\s+/)
      .every(
        (tok) =>
          !tok.includes('.') ||
          /^[A-Z]\.(?:[A-Z]\.)?$/.test(tok) ||
          /^(?:Jr|Sr|St|Mr|Ms|Dr)\.$/i.test(tok),
      );
    if (!validInitialsOnly) return null;
  }

  // Strip English possessive suffix 's / ’s at the end (e.g. "Kendall Jenner's" -> "Kendall Jenner")
  name = name.replace(/(?:'s|’s)$/i, '').trim();
  if (!name || name.length < 2) return null;

  const key = normalizeCharacterKey(name);
  if (!key) return null;

  // Explicit whitelist: known roster names or known celebrities pass immediately
  if (allowedKnownKeys && allowedKnownKeys.has(key)) {
    return name;
  }
  const celeb = lookupKnownCelebrityProfile(name);
  if (celeb) {
    return celeb.canonicalName;
  }

  // Reject pure numbers or strings with digits (except known stage names already matched)
  if (/^\d+$/.test(name) || /\d{2,}/.test(name)) return null;

  // Reject exact junk phrases
  if (JUNK_EXACT_PHRASES.has(key)) return null;

  const tokens = key.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return null;

  // Single-word checks
  if (tokens.length === 1) {
    if (JUNK_SINGLE_WORDS.has(tokens[0])) return null;
    if (JUNK_TOKEN_CONTAINMENT.has(tokens[0])) return null;
  }

  // Reject leading English stop-words/articles/pronouns (e.g. "The Room", "It's ...", "In Beverly")
  if (LEADING_ENGLISH_STOP_WORDS.has(tokens[0])) return null;

  // Reject trailing standalone pronoun or contraction remnant (e.g. "... I", "... It", "... He")
  const lastTok = tokens[tokens.length - 1];
  if (
    lastTok === 'i' ||
    lastTok === 'it' ||
    lastTok === 'he' ||
    lastTok === 'she' ||
    lastTok === 'we' ||
    lastTok === 'they' ||
    lastTok === 'you' ||
    lastTok === 'im' ||
    lastTok === 'ive' ||
    lastTok === 'its' ||
    lastTok === 'hes' ||
    lastTok === 'shes'
  ) {
    return null;
  }

  // Reject if ANY token is a clear meta/planning/scene/location word or English CoT heading phrase
  if (
    tokens.some((tok) => JUNK_TOKEN_CONTAINMENT.has(tok)) ||
    isEnglishHeadingOrMetaPhrase(name)
  ) {
    return null;
  }

  // Reject if name has internal apostrophe other than Irish/Scottish/French/Italian surname particles (O'Connell, D'Angelo, L'...)
  if (name.includes("'") || name.includes('’')) {
    const cleanApos = name.replace(/’/g, "'");
    const validApostrophe = cleanApos
      .split(/\s+/)
      .every(
        (tok) =>
          !tok.includes("'") ||
          /^(?:O|D|L|Mc)'[A-Z][\p{Ll}]+$/u.test(tok),
      );
    if (!validApostrophe) return null;
  }

  return name;
}

export function isJunkCharacterName(
  rawName: string,
  allowedKnownKeys?: Set<string>,
): boolean {
  return sanitizeCharacterName(rawName, allowedKnownKeys) === null;
}

export function buildAllowedRosterKeys(
  comp?: CompanionProfile,
  fallbackMcName?: string,
): Set<string> {
  const keys = new Set<string>();
  const add = (s?: string) => {
    const k = normalizeCharacterKey(s || '');
    if (k && k.length >= 2) keys.add(k);
  };
  add(comp?.mc?.name);
  add(comp?.mc?.canonMcName);
  add(fallbackMcName);
  for (const n of comp?.npcs || []) add(n.name);
  for (const c of comp?.canonCandidates || []) add(c.name);
  return keys;
}

export function cleanJunkPortraitsFromBank(
  bank: PortraitBankConfig,
  comp?: CompanionProfile,
  fallbackMcName?: string,
): { bank: PortraitBankConfig; removedNames: string[] } {
  const allowedKeys = buildAllowedRosterKeys(comp, fallbackMcName);
  const removedNames: string[] = [];
  const kept: CharacterPortrait[] = [];
  const seenKeys = new Set<string>();

  for (const p of bank.portraits || []) {
    if (p.isMc) {
      const k = normalizeCharacterKey(p.name);
      if (k) seenKeys.add(k);
      kept.push(p);
      continue;
    }
    const rawKey = normalizeCharacterKey(p.name);
    if (allowedKeys.has(rawKey)) {
      if (!seenKeys.has(rawKey)) {
        seenKeys.add(rawKey);
        kept.push(p);
      }
      continue;
    }
    const sanitized = sanitizeCharacterName(p.name, allowedKeys);
    if (!sanitized) {
      removedNames.push(p.name);
      continue;
    }
    const cleanKey = normalizeCharacterKey(sanitized);
    if (seenKeys.has(cleanKey)) {
      removedNames.push(p.name);
      continue;
    }
    seenKeys.add(cleanKey);
    kept.push(sanitized !== p.name ? { ...p, name: sanitized } : p);
  }

  return {
    bank: {
      ...bank,
      portraits: kept,
    },
    removedNames,
  };
}

const VISUAL_APPEARANCE_CUE_RE =
  /(?:\b(?:mặc|khoác|diện|đeo|mang|cầm|ngậm|hút|tóc|mái\s*tóc|đôi\s*mắt|ánh\s*mắt|khuôn\s*mặt|gương\s*mặt|làn\s*da|nước\s*da|dáng\s*người|vóc\s*dáng|thân\s*hình|chiều\s*cao|áo|quần|váy|đầm|vest|suit|blazer|jacket|hoodie|vải\s*lanh|linen|lụa|nhung|da\s*bóng|da\s*đen|denim|jeans|thể\s*thao|tracksuit|dự\s*tiệc|giày|bốt|boots|sneaker|kính|mắt\s*kính|dây\s*chuyền|vòng\s*cổ|nhẫn|khuyên\s*tai|đồng\s*hồ|túi\s*xách|mũ|nón|son\s*môi|trang\s*điểm|hình\s*xăm|tattoo|râu|thần\s*thái|khí\s*chất|phong\s*cách|thuốc\s*lá\s*điện\s*tử|vape|điếu\s*thuốc|ly\s*rượu|rượu\s*vang|vệt\s*rượu|dính\s*vệt|màu\s*(?:đen|trắng|xám|đỏ|vàng|bạc|xanh|nâu|hồng|tím|be|kem)|xám\s*than|bạch\s*kim|lạnh\s*lùng|gợi\s*cảm|sang\s*trọng|bụi\s*bặm|thanh\s*lịch|phóng\s*khoáng)\b)/i;

function trimClean(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastBreak = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf(', '),
    sliced.lastIndexOf('; '),
  );
  if (lastBreak >= Math.floor(maxLen * 0.55)) {
    return sliced.slice(0, lastBreak).trim();
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.7)
    ? sliced.slice(0, lastSpace)
    : sliced
  ).trim();
}

export function extractVisualCuesForCharacter(
  cleanStoryText: string,
  charName: string,
): string {
  const text = String(cleanStoryText || '').trim();
  const fullKey = normalizeCharacterKey(charName);
  if (!text || !fullKey) return '';

  // Also check first token for multi-word names (e.g. "Jennie" for "Jennie Kim", "Kendall" for "Kendall Jenner")
  const tokens = fullKey.split(/\s+/).filter(Boolean);
  const primaryAlias =
    tokens.length >= 2 && tokens[0].length >= 4 ? tokens[0] : '';

  const sentences = text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  const collected: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sNorm = normalizeCharacterKey(s);
    const mentions =
      sNorm.includes(fullKey) ||
      (primaryAlias !== '' &&
        new RegExp(`(?:^|[^a-z0-9])${primaryAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`).test(
          sNorm,
        ));

    if (!mentions) continue;

    if (VISUAL_APPEARANCE_CUE_RE.test(s)) {
      collected.push(s);
    } else if (i + 1 < sentences.length) {
      // Check immediately following sentence if it describes appearance/clothing of this character
      const nextS = sentences[i + 1];
      if (VISUAL_APPEARANCE_CUE_RE.test(nextS)) {
        collected.push(nextS);
      }
    }
    if (collected.length >= 2) break;
  }

  if (!collected.length) return '';
  return trimClean(collected.join(' '), 220);
}

const ABSENCE_CUE_RE =
  /(?:khong\s+co\s+mat|vang\s+mat|vang\s+bong|khong\s+o\s+(?:my|day|tai|bua\s+tiec|phong|canh|hien\s+truong|do|los\s+angeles|beverly|hollywood|bua\s+tiec)|khong\s+tham\s+du|khong\s+xuat\s+hien|chua\s+(?:toi|den|xuat\s+hien|co\s+mat|ve)|o\s+cach\s+xa|o\s+nua\s+vong\s+trai\s+dat|khong\s+di\s+cung|ngoai\s+canh|khong\s+lien\s+quan\s+den|bo\s+qua\s+nvc|khong\s+co\s+nvc|khong\s+co\s+nhan\s+vat\s+chinh|khong\s+dua\s+nvc|dang\s+o\s+(?:viet\s+nam|ha\s+noi|sai\s+gon|tp\s*hcm|han\s+quoc|seoul|nhat\s+ban|tokyo|london|paris|noi\s+khac|thanh\s+pho\s+khac|nha\s+rieng|que)|o\s+(?:thanh\s+pho\s+khac|noi\s+khac|ben\s+kia)|da\s+roi\s+(?:di|khoi)|vua\s+roi\s+(?:di|khoi)|chi\s+(?:nhac\s+den|nhac\s+toi|goi\s+dien|nhan\s+tin)|qua\s+(?:dien\s+thoai|tin\s+nhan|man\s+hinh)|not\s+present|absent|not\s+in\s+the\s+us|not\s+in\s+america|not\s+at\s+the\s+party|off-?screen|without\s+(?:the\s+)?mc)/i;

const GENERIC_MC_ABSENCE_RE =
  /(?:\b(?:nvc|mc|nhan\s+vat\s+chinh)\b[^.!?\n]{0,65}(?:khong\s+co\s+mat|vang\s+mat|vang\s+bong|khong\s+o\s+(?:my|day|tai|do|canh|bua\s+tiec)|khong\s+tham\s+du|khong\s+xuat\s+hien|chua\s+(?:toi|den)|ngoai\s+canh|not\s+present|absent|not\s+in\s+the\s+us|off-?screen)|(?:khong\s+co\s+mat|vang\s+mat|khong\s+co|bo\s+qua|khong\s+xuat\s+hien|without)\s+(?:cua\s+)?(?:nvc|mc|nhan\s+vat\s+chinh)\b)/i;

const VIET_SURNAME_KEYS = new Set([
  'nguyen',
  'tran',
  'le',
  'pham',
  'hoang',
  'huynh',
  'phan',
  'vu',
  'vo',
  'dang',
  'bui',
  'do',
  'ho',
  'ngo',
  'duong',
  'ly',
  'truong',
  'dinh',
  'lam',
  'dao',
  'doan',
  'vuong',
  'trinh',
  'cao',
  'thai',
  'luong',
  'ta',
  'mai',
  'chu',
  'la',
  'kieu',
  'phung',
  'bach',
  'han',
  'luc',
  'co',
  'ton',
  'to',
  'mac',
]);

const VIET_HONORIFIC_BEFORE_RE =
  /(?:^|[\s,.;:!?("“«—-])(?:anh|chị|cô|em|chú|bác|ông|bà|cậu|nàng|chàng|tiểu\s+thư|công\s+tử|thiếu\s+gia|ngài|bạn|bé|lão|thầy)\s+$/iu;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sentenceMentionsKey(sentenceNorm: string, key: string): boolean {
  if (!key || key.length < 2) return false;
  if (key.includes(' ')) return sentenceNorm.includes(key);
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(key)}(?:$|[^a-z0-9])`).test(
    sentenceNorm,
  );
}

/**
 * Removes quoted dialogue so narrative POV checks (e.g. first-person "tôi bước/nói")
 * do not false-trigger on dialogue spoken by other characters in a third-person scene.
 */
export function stripQuotedDialogue(text: string): string {
  return String(text || '')
    .replace(/“[^”\n]{1,600}”/g, ' ')
    .replace(/"[^"\n]{1,600}"/g, ' ')
    .replace(/«[^»\n]{1,600}»/g, ' ');
}

/**
 * Matches a character name in Vietnamese/Western prose while preserving Vietnamese diacritics
 * and requiring proper capitalization for single-word terms.
 * Prevents catastrophic false positives such as matching "Hoàng Long" against "lòng" / "lông" / "lồng".
 */
export function findExactProperNameInText(
  text: string,
  charName: string,
  options?: { allowHonorificShortName?: boolean },
): {
  count: number;
  firstIndex: number;
  lastIndex: number;
  matchedDisplay: string;
} {
  const rawText = String(text || '');
  const cleanName = String(charName || '').trim();
  if (!rawText || !cleanName || cleanName.length < 2) {
    return { count: 0, firstIndex: -1, lastIndex: -1, matchedDisplay: cleanName };
  }

  const terms: Array<{
    term: string;
    requireCapital: boolean;
    requireHonorificOrColon: boolean;
  }> = [];
  const seenTerms = new Set<string>();

  const pushTerm = (
    term: string,
    requireCapital: boolean,
    requireHonorificOrColon: boolean,
  ) => {
    const t = term.trim();
    if (!t || t.length < 2) return;
    const k = t.toLowerCase();
    if (seenTerms.has(k)) return;
    seenTerms.add(k);
    terms.push({ term: t, requireCapital, requireHonorificOrColon });
  };

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const isMultiWord = parts.length >= 2;
  // Full name: diacritic-exact; single-word names must start with uppercase letter
  pushTerm(cleanName, !isMultiWord, false);

  // Known celebrity aliases (exact spelling, uppercase-initial required for single-word aliases)
  const celeb = lookupKnownCelebrityProfile(cleanName);
  if (celeb) {
    pushTerm(celeb.canonicalName, !/\s/.test(celeb.canonicalName), false);
    for (const alias of celeb.aliases || []) {
      const a = alias.trim();
      if (a.length >= 3) {
        pushTerm(a, !/\s/.test(a), false);
      }
    }
  }

  if (isMultiWord) {
    const firstKey = normalizeCharacterKey(parts[0]);
    const lastPart = parts[parts.length - 1];
    // For Western multi-word names (e.g. "Kendall Jenner"), allow capitalized first name if >= 4 chars
    if (parts[0].length >= 4 && !VIET_SURNAME_KEYS.has(firstKey)) {
      pushTerm(parts[0], true, false);
    }
    // For Vietnamese multi-word names, only match the short given name when preceded by an honorific
    // (e.g. "anh Thiện", "cô Linh") or followed by speaker colon ("Thiện:"), preserving exact diacritics.
    if (
      options?.allowHonorificShortName &&
      VIET_SURNAME_KEYS.has(firstKey) &&
      lastPart.length >= 3
    ) {
      pushTerm(lastPart, true, true);
    }
  }

  let totalCount = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  let matchedDisplay = cleanName;
  let bestDisplayScore = -1;

  for (const spec of terms) {
    const escaped = escapeRegExp(spec.term);
    const re = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu');
    let m: RegExpExecArray | null;
    let termCount = 0;
    let termLastMatch = '';

    while ((m = re.exec(rawText)) !== null) {
      const matched = m[0];
      if (spec.requireCapital && !/^[\p{Lu}]/u.test(matched)) continue;

      if (spec.requireHonorificOrColon) {
        const beforeSlice = rawText.slice(Math.max(0, m.index - 24), m.index);
        const afterSlice = rawText.slice(
          m.index + matched.length,
          m.index + matched.length + 6,
        );
        const hasHonorific = VIET_HONORIFIC_BEFORE_RE.test(beforeSlice);
        const isSpeakerColon = /^\s*:\s*/.test(afterSlice);
        if (!hasHonorific && !isSpeakerColon) continue;
      }

      termCount += 1;
      totalCount += 1;
      if (firstIndex < 0 || m.index < firstIndex) firstIndex = m.index;
      if (m.index > lastIndex) lastIndex = m.index;
      termLastMatch = matched.trim();
    }

    if (termCount > 0 && termLastMatch) {
      // Prefer full name display over short alias when both match
      const displayScore =
        termCount + (spec.term.includes(' ') ? 10 : 0) - (spec.requireHonorificOrColon ? 5 : 0);
      if (displayScore > bestDisplayScore) {
        bestDisplayScore = displayScore;
        matchedDisplay = spec.requireHonorificOrColon ? cleanName : termLastMatch;
      }
    }
  }

  return { count: totalCount, firstIndex, lastIndex, matchedDisplay };
}

/**
 * Checks whether a character is explicitly stated as absent / not at the scene
 * in the given clean text (without active presence in another sentence).
 */
export function isCharacterExplicitlyAbsent(
  cleanText: string,
  charName: string,
  checkGenericMc = false,
): boolean {
  const raw = String(cleanText || '').trim();
  if (!raw) return false;

  const rawSentences = raw
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (checkGenericMc) {
    const fullNorm = normalizeCharacterKey(raw);
    if (GENERIC_MC_ABSENCE_RE.test(fullNorm)) {
      return true;
    }
  }

  const cleanChar = String(charName || '').trim();
  if (!cleanChar || cleanChar.length < 2) return false;

  let absenceHits = 0;
  let activeHits = 0;

  for (const rawS of rawSentences) {
    const exactHit = findExactProperNameInText(rawS, cleanChar, {
      allowHonorificShortName: true,
    });
    if (exactHit.count === 0) continue;
    const normS = normalizeCharacterKey(rawS);
    if (ABSENCE_CUE_RE.test(normS)) {
      absenceHits += 1;
    } else {
      activeHits += 1;
    }
  }

  return absenceHits > 0 && activeHits === 0;
}

/**
 * Determines whether the Main Character (MC/NVC) is genuinely present in a turn.
 * Returns false if user or story explicitly states MC is absent (e.g. not in the scene / another location),
 * OR if MC has a defined name that is never mentioned in the story prose (and prose is not unquoted 1st-person POV).
 */
export function isMcPresentInTurn(
  cleanAi: string,
  cleanUser: string,
  mcName: string,
  mcPronoun?: string,
): boolean {
  const aiText = String(cleanAi || '').trim();
  const userText = String(cleanUser || '').trim();
  const combined = [userText, aiText].filter(Boolean).join('\n');
  if (!combined) return false;

  // 1. Explicit absence statement in user prompt or story prose immediately marks MC as absent
  if (
    isCharacterExplicitlyAbsent(userText, mcName, true) ||
    isCharacterExplicitlyAbsent(aiText, mcName, true)
  ) {
    return false;
  }

  const mcKey = normalizeCharacterKey(mcName);
  const pronounKey = normalizeCharacterKey(mcPronoun || '');
  const unquotedAiNorm = normalizeCharacterKey(stripQuotedDialogue(aiText));

  const hasFirstPersonNarration =
    Boolean(aiText) &&
    /\btoi\s+(?:buoc|noi|nhin|cuoi|cam|quay|ngoi|dung|di|hoi|dap|tho\s+dai|nhiu\s+may|im\s+lang|khong\s+ngo|khe|lang\s+le|dua\s+mat)\b/.test(
      unquotedAiNorm,
    );

  // 2. If MC has a specific name, require diacritic-exact match in prose (never strip diacritics on short names)
  if (mcKey && mcKey !== 'nhan vat chinh' && mcKey !== 'mc' && mcKey !== 'nvc') {
    const exactInAi = findExactProperNameInText(aiText, mcName, {
      allowHonorificShortName: true,
    });
    if (exactInAi.count > 0) return true;

    if (
      pronounKey.length >= 3 &&
      !/^(?:toi|anh|em|co|cau|han|ga|ta|minh|nhan\s+vat|nguoi\s+choi|mc|npc|nvc)$/.test(
        pronounKey,
      ) &&
      sentenceMentionsKey(unquotedAiNorm, pronounKey)
    ) {
      return true;
    }

    // Not mentioned in AI prose -> only treat as present if AI prose is empty and user explicitly mentioned MC
    if (!aiText && findExactProperNameInText(userText, mcName).count > 0) {
      return true;
    }

    // Unquoted first-person narration ("tôi bước", "tôi nhìn" outside dialogue quotes)
    if (hasFirstPersonNarration) {
      return true;
    }

    return false;
  }

  // 3. When MC has no custom name yet, only treat MC as present if unquoted 1st-person POV or explicit MC mention exists
  if (
    /\b(?:nhan\s+vat\s+chinh|nvc)\b/.test(unquotedAiNorm) ||
    hasFirstPersonNarration
  ) {
    return true;
  }
  return false;
}

export interface VividNpcProfileResult {
  role: string;
  age: string;
  birthday: string;
  fashionStyle: string;
  personality: string;
  appearance: string;
  relationships: string;
  signature: string;
  source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
}

export function resolveLocalVividNpcProfile(options: {
  name: string;
  isMc: boolean;
  comp?: CompanionProfile;
  cleanStoryText?: string;
  storyClock?: StoryClockState;
}): VividNpcProfileResult {
  const { name, isMc, comp, cleanStoryText, storyClock } = options;
  const key = normalizeCharacterKey(name);

  let role = '';
  let age = '';
  let birthday = '';
  let fashionStyle = '';
  let personality = '';
  let appearance = '';
  let relationships = '';
  let signature = '';
  let fromCompanion = false;

  if (isMc && comp?.mc) {
    role = comp.mc.originRole?.trim() || 'Nhân vật chính';
    age = comp.mc.age?.trim()
      ? /^\d+$/.test(comp.mc.age.trim())
        ? `${comp.mc.age.trim()} tuổi`
        : comp.mc.age.trim()
      : '';
    personality = comp.mc.personality?.trim() || '';
    appearance = [
      comp.mc.gender || '',
      age,
      comp.mc.appearance?.trim() || '',
    ]
      .filter(Boolean)
      .join(', ');
    relationships = comp.mc.canonMcRelation?.trim() || '';
    fromCompanion = Boolean(appearance || personality || age);
  } else if (comp) {
    const matchedNpc = (comp.npcs || []).find(
      (n) => normalizeCharacterKey(n.name) === key,
    );
    if (matchedNpc) {
      role = matchedNpc.role?.trim() || '';
      age = matchedNpc.age?.trim() || '';
      birthday = matchedNpc.birthday?.trim() || '';
      fashionStyle = matchedNpc.fashionStyle?.trim() || '';
      personality = matchedNpc.personality?.trim() || '';
      appearance = (matchedNpc.appearance || matchedNpc.desc || '').trim();
      relationships = matchedNpc.relationships?.trim() || '';
      signature = matchedNpc.signature?.trim() || '';
      fromCompanion = Boolean(
        appearance ||
          personality ||
          relationships ||
          signature ||
          age ||
          birthday ||
          fashionStyle,
      );
    }
    if (!appearance) {
      const matchedCanon = (comp.canonCandidates || []).find(
        (c) => normalizeCharacterKey(c.name) === key,
      );
      if (matchedCanon) {
        if (!role) role = matchedCanon.role?.trim() || '';
        if (!age && matchedCanon.age?.trim()) {
          age = /^\d+$/.test(matchedCanon.age.trim())
            ? `${matchedCanon.age.trim()} tuổi`
            : matchedCanon.age.trim();
        }
        if (!personality) personality = matchedCanon.personality?.trim() || '';
        appearance = [
          matchedCanon.gender || '',
          matchedCanon.age ? `${matchedCanon.age} tuổi` : '',
          matchedCanon.appearance?.trim() || '',
        ]
          .filter(Boolean)
          .join(', ');
        fromCompanion = fromCompanion || Boolean(appearance || personality || age);
      }
    }
  }

  const storyCue = cleanStoryText
    ? extractVisualCuesForCharacter(cleanStoryText, name)
    : '';
  const celeb = lookupKnownCelebrityProfile(name);

  if (!role && celeb?.role) role = celeb.role;
  if (!birthday && celeb?.birthday) birthday = celeb.birthday;
  if (!age && birthday) age = computeAgeFromBirthday(birthday, storyClock);
  if (!fashionStyle && celeb?.fashionStyle) fashionStyle = celeb.fashionStyle;
  if (!personality && celeb?.personality) personality = celeb.personality;
  if (!relationships && celeb?.relationships) relationships = celeb.relationships;
  if (!signature && celeb?.signature) signature = celeb.signature;

  const cleanAge = trimClean(age, 40);
  const cleanBirthday = trimClean(birthday, 40);
  const cleanFashion = trimClean(fashionStyle, 240);

  if (fromCompanion && appearance) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: trimClean(appearance, 280),
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'companion',
    };
  }

  if (storyCue && celeb) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: trimClean(
        `Trong cảnh: ${storyCue} — Đặc trưng: ${celeb.appearance}`,
        280,
      ),
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'combined',
    };
  }

  if (storyCue) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: storyCue,
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'story',
    };
  }

  if (celeb) {
    return {
      role,
      age: cleanAge,
      birthday: cleanBirthday,
      fashionStyle: cleanFashion,
      personality: trimClean(personality, 240),
      appearance: celeb.appearance,
      relationships: trimClean(relationships, 220),
      signature: trimClean(signature, 200),
      source: 'celebrity',
    };
  }

  return {
    role,
    age: cleanAge,
    birthday: cleanBirthday,
    fashionStyle: cleanFashion,
    personality: trimClean(personality, 240),
    appearance: trimClean(appearance, 280),
    relationships: trimClean(relationships, 220),
    signature: trimClean(signature, 200),
    source: fromCompanion ? 'companion' : 'none',
  };
}

export function resolveLocalCharacterAppearance(options: {
  name: string;
  isMc: boolean;
  comp?: CompanionProfile;
  cleanStoryText?: string;
  storyClock?: StoryClockState;
}): {
  appearance: string;
  roleSuggestion?: string;
  source: 'companion' | 'story' | 'celebrity' | 'combined' | 'none';
} {
  const vivid = resolveLocalVividNpcProfile(options);
  return {
    appearance: vivid.appearance,
    roleSuggestion: vivid.role || undefined,
    source: vivid.source,
  };
}

export interface SpeakerLineMatch {
  leadingPrefix: string;
  displayName: string;
  canonicalName: string;
  stageNote: string;
  hasColon: boolean;
  remainder: string;
}

const NON_SPEAKER_LABEL_KEYS = new Set([
  // Vietnamese structural / narrative / meta labels
  'boi canh',
  'thoi gian',
  'dia diem',
  'vi tri',
  'tam trang',
  'trang thai',
  'ghi chu',
  'luu y',
  'tom tat',
  'chu thich',
  'muc tieu',
  'goi y',
  'he thong',
  'thong bao',
  'canh bao',
  'hau ky',
  'thong ke',
  'suy nghi',
  'nghi tham',
  'noi tam',
  'loi thoai',
  'hanh dong',
  'tinh cach',
  'ngoai hinh',
  'quan he',
  'diem nhan',
  'vai tro',
  'moc thoi gian',
  'ket qua',
  'dien bien',
  'luot goi',
  'luot tra loi',
  'nhiem vu',
  'ky nang',
  'vat pham',
  'trang bi',
  'nhap vai',
  'chuong',
  'phan',
  'canh',
  'trang',
  'ngay',
  'thang',
  'nam',
  'gio',
  'phut',
  'buoi',
  'thoi tiet',
  'khong khi',
  'am thanh',
  'anh sang',
  'trang phuc',
  'phu kien',
  'danh sach',
  'chi tiet',
  'su kien',
  'ngu canh',
  'quy tac',
  'the gioi',
  'nhan vat',
  'nhan vat chinh',
  'nguoi ke chuyen',
  'dan y',
  'ke hoach',
  'phan tich',
  'tong ket',
  // English planning / thinking / meta labels
  'defining the setting',
  'expanding the guest list',
  'crafting the narrative flow',
  'analyzing the aftermath',
  'analysing the aftermath',
  'narrative flow',
  'guest list',
  'word count',
  'character states',
  'character list',
  'scene setup',
  'scene summary',
  'plot summary',
  'story beats',
  'pacing notes',
  'tone check',
  'continuity check',
  'system boot',
  'resource loading',
  'final check',
  'next steps',
  'action plan',
  'scene',
  'setting',
  'goal',
  'goals',
  'plan',
  'planning',
  'stage',
  'step',
  'phase',
  'note',
  'notes',
  'status',
  'location',
  'time',
  'date',
  'mood',
  'summary',
  'outfit',
  'action',
  'dialogue',
  'context',
  'rules',
  'prompt',
  'output',
  'result',
  'narrative',
  'narrator',
  'system',
  'chapter',
  'part',
  'pov',
  'tone',
  'pacing',
  'aftermath',
  'checklist',
  'outline',
  'draft',
  'thinking',
  'thought',
  'reasoning',
  'analysis',
  'weather',
  'atmosphere',
  'transition',
]);

const NON_SPEAKER_PREFIX_RE =
  /^(?:defining|expanding|crafting|analyzing|analysing|establishing|developing|building|checking|reviewing|introducing|focusing|maintaining|ensuring|highlighting|exploring|managing|considering|evaluating|determining|plan for|stage|step|phase|chapter|part|scene|beat|section|word count|chuong|phan|canh|trang|buoc|giai doan|muc|luu y|ghi chu|thong ke|tom tat|boi canh|thoi gian|dia diem|trang thai)\b/i;

const VI_COMMON_NON_NAME_SINGLE = new Set([
  'sau',
  'khi',
  'nhung',
  'roi',
  'tuy',
  'neu',
  'trong',
  'ngoai',
  'giua',
  'truoc',
  'tren',
  'duoi',
  'dem',
  'sang',
  'chieu',
  'toi',
  'trua',
  'ngay',
  'thang',
  'nam',
  'phong',
  'nha',
  'xe',
  'cua',
  'duong',
  'tieng',
  'anh',
  'co',
  'chi',
  'em',
  'ong',
  'ba',
  'han',
  'nang',
  'cau',
  'to',
  'minh',
  'ta',
  'nguoi',
  'ho',
  'chung',
  'khong',
  'mot',
  'hai',
  'vua',
  'dang',
  'da',
  'se',
  'con',
  'cung',
  'van',
  'lai',
  'rat',
  'qua',
  'hon',
  'that',
  'chi',
  'chinh',
  'ngay',
  'hom',
  'nay',
  'mai',
  'luc',
  'vai',
  'nhieu',
  'may',
  'bao',
  'nao',
  'gi',
  'ai',
  'dau',
  'sao',
  'the',
  'vay',
  'nen',
  'vi',
  'do',
  'boi',
  'du',
  'mac',
  'hoac',
  'hay',
  'ma',
  'va',
  'voi',
  'cho',
  'tu',
  'den',
  've',
  'tai',
  'o',
  'theo',
  'len',
  'xuong',
  'ra',
  'vao',
  'di',
  'thay',
  'nghe',
  'noi',
  'hoi',
  'dap',
  'cuoi',
  'nhin',
  'buoc',
  'dung',
  'ngoi',
  'cam',
  'dua',
  'mo',
  'dong',
  'goi',
  'nhan',
  'nghi',
  'cam',
  'biet',
  'muon',
  'can',
  'phai',
  'la',
  'bi',
  'duoc',
  'lam',
  'de',
  'het',
  'xong',
  'ro',
  'khe',
  'nhe',
  'cham',
  'nhanh',
  'lanh',
  'am',
  'bong',
  'chot',
  'dot',
  'nhac',
  'den',
  'ruou',
  'ly',
  'ban',
  'ghe',
  'san',
  'tuong',
  'kinh',
  'mat',
  'moi',
  'tay',
  'vai',
  'toc',
  'giong',
  'hoi',
  'nhip',
  'tim',
  'mui',
  'mau',
  'ao',
  'quan',
  'vay',
  'dam',
  'giay',
  'tui',
  'nhan',
  'dien',
  'thoai',
  'tin',
  'cuoc',
  'bua',
  'lan',
  'chuyen',
  'gio',
  'phut',
  'giay',
  'canh',
  'tiec',
  'pho',
  'quan',
  'khu',
  'noi',
  'cho',
  'goc',
  'phia',
  'ben',
  'canh',
  'dau',
  'cuoi',
  'toan',
  'ca',
  'moi',
  'rieng',
  'chung',
  'khac',
  'cung',
  'dung',
  'sai',
  'tot',
  'te',
  'dep',
  'xau',
  'moi',
  'cu',
  'lon',
  'nho',
  'cao',
  'thap',
  'dai',
  'ngan',
  'sau',
]);

const LOWERCASE_NAME_PARTICLES = new Set([
  'van',
  'von',
  'de',
  'da',
  'di',
  'del',
  'della',
  'la',
  'le',
  'du',
  'al',
  'el',
  'bin',
  'binti',
]);

/**
 * Detects a valid character speaker prefix at the start of a story line
 * (e.g. `Central Cee: "..."`, `**Kendall Jenner**: "..."`, `[Jennie Kim]: ...`, `MGK (cười khẽ): ...`)
 * while strictly rejecting English thinking/planning headers and non-character labels.
 */
export function extractSpeakerPrefixFromLine(
  line: string,
  knownCharacterKeys?: Set<string>,
): SpeakerLineMatch | null {
  if (!line || line.length < 3) return null;
  const trimmedStart = line.trimStart();
  if (!trimmedStart) return null;

  // Never badge raw XML tags, markdown headings, numbered outline items, or timestamps
  if (
    trimmedStart.startsWith('<') ||
    trimmedStart.startsWith('#') ||
    /^\d+[.)]\s/.test(trimmedStart) ||
    /^\d{1,2}:\d{2}\b/.test(trimmedStart)
  ) {
    return null;
  }

  let leadingPrefix = '';
  let rawName = '';
  let stageNote = '';
  let remainder = '';
  let hasColon = true;

  // Pattern 1: Bold speaker with colon — `**Name**: ...`, `**Name:** ...`, `**Name** (action): ...`
  const boldColonRe =
    /^([—–-]\s+)?\*\*([^*\n]{2,40}?)(?:\s*(\([^)\n]{1,34}\)))?\s*:\*\*\s*(.*)$|^([—–-]\s+)?\*\*([^*\n]{2,40}?)\*\*(\s*\([^)\n]{1,34}\))?\s*:\s*(.*)$/;
  const mBoldColon = boldColonRe.exec(trimmedStart);

  // Pattern 2: Bracketed speaker with colon — `[Name]: ...` or `[Name] (action): ...`
  const bracketColonRe =
    /^([—–-]\s+)?\[([^\]\n]{2,40}?)\](\s*\([^)\n]{1,34}\))?\s*:\s*(.*)$/;
  const mBracket = !mBoldColon ? bracketColonRe.exec(trimmedStart) : null;

  // Pattern 3: Plain speaker with colon — `Name: ...` or `Name (action): ...` or `— Name: ...`
  const plainColonRe =
    /^([—–-]\s+)?([^\n:()[\]{}<>*"]{2,38}?)(\s*\([^)\n]{1,34}\))?\s*:\s+(.*)$/;
  const mPlain =
    !mBoldColon && !mBracket ? plainColonRe.exec(trimmedStart) : null;

  // Pattern 4: Bold speaker followed by em-dash & dialogue/action — `**Name** — "..."`
  const boldDashRe = /^([—–-]\s+)?\*\*([^*\n]{2,36}?)\*\*\s+[—–]\s+(.*)$/;
  const mBoldDash =
    !mBoldColon && !mBracket && !mPlain
      ? boldDashRe.exec(trimmedStart)
      : null;

  if (mBoldColon) {
    if (mBoldColon[2] !== undefined) {
      leadingPrefix = mBoldColon[1] || '';
      rawName = mBoldColon[2].trim();
      stageNote = mBoldColon[3] ? ` ${mBoldColon[3].trim()}` : '';
      remainder = mBoldColon[4] || '';
    } else {
      leadingPrefix = mBoldColon[5] || '';
      rawName = (mBoldColon[6] || '').trim();
      stageNote = mBoldColon[7] || '';
      remainder = mBoldColon[8] || '';
    }
  } else if (mBracket) {
    leadingPrefix = mBracket[1] || '';
    rawName = mBracket[2].trim();
    stageNote = mBracket[3] || '';
    remainder = mBracket[4] || '';
  } else if (mPlain) {
    leadingPrefix = mPlain[1] || '';
    rawName = mPlain[2].trim();
    stageNote = mPlain[3] || '';
    remainder = mPlain[4] || '';
  } else if (mBoldDash) {
    leadingPrefix = mBoldDash[1] || '';
    rawName = mBoldDash[2].trim();
    stageNote = '';
    hasColon = false;
    remainder = `— ${mBoldDash[3] || ''}`;
  } else {
    return null;
  }

  // Must not be a URL scheme (http://) or empty remainder on plain text
  if (!rawName || /^https?$/i.test(rawName) || remainder.startsWith('//')) {
    return null;
  }

  // Clean stray outer punctuation while preserving author spelling
  const displayName = rawName
    .replace(/[*_`~<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!displayName || displayName.length < 2 || displayName.length > 36) {
    return null;
  }

  const key = normalizeCharacterKey(displayName);
  if (!key) return null;

  // Hard reject structural/meta/thinking labels and English CoT headings regardless of capitalization
  if (
    NON_SPEAKER_LABEL_KEYS.has(key) ||
    NON_SPEAKER_PREFIX_RE.test(key) ||
    isEnglishHeadingOrMetaPhrase(displayName)
  ) {
    return null;
  }

  const sanitized = sanitizeCharacterName(displayName, knownCharacterKeys);
  if (!sanitized) return null;

  const isKnownWhitelisted = Boolean(
    (knownCharacterKeys && knownCharacterKeys.has(key)) ||
      lookupKnownCelebrityProfile(displayName),
  );

  if (!isKnownWhitelisted) {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return null;

    // Require proper capitalization for non-whitelisted names (e.g. "Trần Thiện", "Minh Anh", "Alex")
    const validCaps = words.every((w, idx) => {
      const lower = w.toLowerCase();
      if (idx > 0 && idx < words.length - 1 && LOWERCASE_NAME_PARTICLES.has(lower)) {
        return true;
      }
      return /^[\p{Lu}]/u.test(w);
    });
    if (!validCaps) return null;

    // Reject single-word unknown candidates that are common Vietnamese/English non-name words
    if (words.length === 1) {
      if (VI_COMMON_NON_NAME_SINGLE.has(key)) return null;
      // Single-word unknown name must be at least 2 letters and only letters/apostrophe/hyphen
      if (!/^[\p{L}][\p{L}'’-]{1,18}$/u.test(displayName)) return null;
    }
  }

  return {
    leadingPrefix,
    displayName,
    canonicalName: sanitized,
    stageNote,
    hasColon,
    remainder,
  };
}

