import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

const comparisonRows = [
  ["招聘入口", "校园招聘为主，社招极少", "秋招为主力批次，春招补录", "管理培训生（MT）项目为主"],
  ["招聘时间", "提前批 7—8 月；正式批 9—11 月；补录次年 3—5 月", "秋招 8—10 月；春招 3—5 月补录", "8—10 月集中爆发，部分企业全年滚动招聘"],
  ["核心流程", "网申 → 笔试 → 半结构化面试 → 体检政审", "简历筛选 → 笔试/测评 → 业务面 → HR 谈薪", "英文网申 → 测评 → AC 面 → 终面"],
  ["决定性因素", "学校背景、专业匹配度、稳定性", "实习经历、技术/业务能力、抗压能力", "英语、领导力、跨文化适应与商业敏感度"],
  ["稳定性", "较高；仍需区分垄断性与一般竞争性国企", "中等偏低，存在裁员和岗位调整风险", "较高；需核验在华业务连续性"],
  ["晋升与强度", "晋升相对慢，工作强度通常较低", "能力导向、晋升较快，工作强度较高", "体系规范，工作生活平衡通常较好"],
  ["简历重点", "学校、专业排名、党员/学生干部、稳定性", "实习、项目产出、量化成果、技术能力", "英文简历、开放性问题、国际化经历"],
  ["关键风险", "劳务派遣、用工性质和行业景气度", "裁员、社保基数、期权替代现金和高强度", "假外企、撤离风险和文化隔阂"],
];

const companyTypes = [
  { title: "央国企", summary: "适合重视稳定、福利保障、长期定居和清晰规则的人。校园招聘是主渠道，笔试常含行测、专业知识和企业文化；面试重视稳定性、服从性与岗位适配。", strengths: "稳定性较高，福利保障相对全面，通常有补充医疗、企业年金或住房支持。", cautions: "确认正式工与劳务派遣的用工性质；非垄断性企业的稳定性不能想当然。" },
  { title: "私企（互联网大厂）", summary: "适合实习丰富、技术或业务能力较强、追求成长速度和收入上限且能接受波动的人。招聘重视“能否立即创造价值”。", strengths: "成长速度快、能力导向、薪资与股权激励上限更高。", cautions: "核验业务健康度、现金薪资与社保公积金基数；不要把期权承诺等同于实际收入。" },
  { title: "外企", summary: "适合英语较好、偏好规范流程、工作生活平衡与跨文化环境的人。MT 项目、英文材料、在线测评和 AC 面较常见。", strengths: "制度相对规范、培训体系完善、工作生活平衡通常更好。", cautions: "核验总部汇报线和英文是否为日常工作语言，并确认在华业务是否持续。" },
];

const preparationRows = [
  ["核心准备", "行测 + 专业知识", "技术/业务能力 + 实习经历", "英语 + 案例分析 + 领导力"],
  ["简历重点", "学校背景、专业排名、党员/学生干部", "实习、项目产出、量化成果", "英文简历、开放性问题"],
  ["面试形式", "半结构化面试", "技术面 + 业务面 + HR 面", "AC 面（群面、案例）+ 终面"],
  ["投递策略", "优先定居城市或基层匹配岗，关注补录", "提前批与秋招并行，实习转正优先", "8—10 月集中投递 MT，提前准备开放题"],
];

export default function EmploymentCompanyGuidePage() {
  return <main className="employment-guide-page"><div className="employment-guide-container">
    <Link className="ghost-button" href="/"><ArrowLeft size={16} /> 返回产品首页</Link>
    <header className="employment-guide-header"><span className="eyebrow">就业路径 · 延伸参考资料</span><h1>央国企、私企、外企区别与就业选择指南</h1><p>企业类型选择是校招前的关键决策。先判断自己更适合怎样的工作环境、风险水平和发展节奏，再针对性准备材料与招聘环节。</p><small>薪资、岗位、招聘时间和用工规则会随企业、地区和年份变化；具体以目标企业当期招聘公告、Offer 与劳动合同为准。</small></header>
    <nav className="employment-guide-nav" aria-label="指南目录"><a href="#comparison">核心差异</a><a href="#types">三类企业</a><a href="#fit">适配度自评</a><a href="#prepare">准备建议</a></nav>
    <section className="guide-section" id="comparison"><h2>一、三类企业核心差异</h2><div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>维度</th><th>央国企</th><th>私企（互联网大厂）</th><th>外企</th></tr></thead><tbody>{comparisonRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div></section>
    <section className="guide-section" id="types"><h2>二、三类企业的选择重点</h2><div className="company-type-grid">{companyTypes.map((type) => <article key={type.title}><h3>{type.title}</h3><p>{type.summary}</p><dl><div><dt>优势</dt><dd>{type.strengths}</dd></div><div><dt>核验重点</dt><dd>{type.cautions}</dd></div></dl></article>)}</div></section>
    <section className="guide-section" id="fit"><h2>三、文化适配度自评</h2><p className="guide-lead">没有“普遍更好”的企业类型。用下列维度判断你的偏好，并把结论带回节点 2 的目标公司清单。</p><div className="fit-grid"><div><strong>偏向央国企</strong><span>偏好明确规则、稳定和长期定居；能接受层级、较慢晋升与延迟回报。</span></div><div><strong>偏向私企</strong><span>愿意接受高强度和结果压力；更重视快速成长、即时反馈、能力与收入上限。</span></div><div><strong>偏向外企</strong><span>英语和跨文化沟通基础较好；偏好规范流程、相对平衡的工作节奏与全球化环境。</span></div></div><p className="detail-note">不确定时，不要仅凭企业标签排除机会。可以并行准备行测与技术/业务面试，通过宣讲、实习和面试了解真实团队文化；最终比较具体岗位、直属团队、城市与 Offer 条款。</p></section>
    <section className="guide-section" id="prepare"><h2>四、针对性准备建议</h2><div className="detail-table-wrap"><table className="detail-table"><thead><tr><th>准备事项</th><th>央国企</th><th>私企（互联网大厂）</th><th>外企</th></tr></thead><tbody>{preparationRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div><div className="guide-actions"><a href="https://www.ncss.cn/" target="_blank" rel="noreferrer">国家大学生就业服务平台 <ExternalLink size={14} /></a><a href="https://www.mohrss.gov.cn/" target="_blank" rel="noreferrer">人社部就业服务信息 <ExternalLink size={14} /></a></div></section>
  </div></main>;
}
