import validator from 'validator';
import nconf from 'nconf';
import meta from '../meta';
import user from '../user';
import categories from '../categories';
import topics from '../topics';
import privileges from '../privileges';
import pagination from '../pagination';
import utils from '../utils';
import helpers from './helpers';
import { Request, Response } from 'express';

export const tagsController:any = {};



interface customeRequest extends Request {
    uid?: number;
  }


tagsController.getTag = async function (req: customeRequest, res: Response): Promise<void> {
    const tag = validator.escape(utils.cleanUpTag(req.params.tag, meta.config.maximumTagLength));
    const page = (req.query.page, 10) || 1;
    const cid: (string | any)[] | undefined = Array.isArray(req.query.cid) ? req.query.cid : req.query.cid ? [req.query.cid] : undefined;

    const templateData: any = {
        topics: [],
        tag: tag,
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]', url: '/tags' }, { text: tag }]),
        title: `[[pages:tag, ${tag}]]`,
    };

    const [settings, cids, categoryData, isPrivileged] = await Promise.all([
        user.getSettings(req.uid),
        cid || categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read'),
        helpers.getSelectedCategory(cid),
        user.isPrivileged(req.uid),
    ]);

    const start = Math.max(0, (page - 1) * settings.topicsPerPage);
    const stop = start + settings.topicsPerPage - 1;

    const [topicCount, tids] = await Promise.all([
        topics.getTagTopicCount(tag, cids),
        topics.getTagTidsByCids(tag, cids, start, stop),
    ]);

    templateData.topics = await topics.getTopics(tids, req.uid);
    templateData.showSelect = isPrivileged;
    templateData.showTopicTools = isPrivileged;
    templateData.allCategoriesUrl = `tags/${tag}${helpers.buildQueryString(req.query, 'cid', '')}`;
    templateData.selectedCategory = categoryData.selectedCategory;
    templateData.selectedCids = categoryData.selectedCids;
    topics.calculateTopicIndices(templateData.topics, start);
    res.locals.metaTags = [
        {
            name: 'title',
            content: tag,
        },
        {
            property: 'og:title',
            content: tag,
        },
    ];

    const pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));
    templateData.pagination = pagination.create(page, pageCount, req.query);
    helpers.addLinkTags({ url: `tags/${tag}`, res: req.res, tags: templateData.pagination.rel });

    templateData['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
    templateData.rssFeedUrl = `${nconf.get('relative_path')}/tags/${tag}.rss`;
    res.render('tag', templateData);
};

tagsController.getTags = async function (req: customeRequest, res: Response): Promise<void> {
    const cids = await categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read');
    const [canSearch, tags] = await Promise.all([
        privileges.global.can('search:tags', req.uid),
        topics.getCategoryTagsData(cids, 0, 99),
    ]);

    res.render('tags', {
        tags: tags.filter(Boolean),
        displayTagSearch: canSearch,
        nextStart: 100,
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]' }]),
        title: '[[pages:tags]]',
    });
};